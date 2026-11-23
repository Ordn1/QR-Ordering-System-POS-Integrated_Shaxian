import base64
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
import hashlib
import hmac
import json
import logging
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import AuthenticationError, BusinessRuleError, NotFoundError
from app.models import (
    AuditLog,
    KitchenQueue,
    Payment,
    Session,
    SessionDevice,
    Table,
    Transaction,
    TransactionItem,
)
from app.models.enums import PaymentMethod, PaymentStatus, PrintStatus, Tender
from app.schemas.queue import SettlementWrite
from app.services import pos as pos_service
from app.services import queue as queue_service
from app.services import session as session_service
from app.services import verification as verification_service
from app.websocket import events

logger = logging.getLogger(__name__)

PAYMONGO_BASE_URL = "https://api.paymongo.com/v1"
MIN_ONLINE_AMOUNT = Decimal("20.00")

# Payment references: PayMongo hosted checkout sessions start with "cs_"; QR Ph
# payments run on a payment intent ("pi_") whose QR we show on our own receipt page.
CHECKOUT_PREFIX = "cs_"
QRPH_PREFIX = "pi_"


@dataclass(frozen=True)
class CounterSettlement:
    transaction: Transaction
    tender: Tender
    tendered: Decimal
    change_due: Decimal
    transmission: pos_service.Transmission | None
    closed: Session | None


# Validate
def _auth_headers() -> dict[str, str]:
    raw = f"{settings.PAYMONGO_SECRET_KEY}:".encode("utf-8")
    token = base64.b64encode(raw).decode("utf-8")
    return {
        "Authorization": f"Basic {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


# Validate
def verify_paymongo_signature(
    raw_body: bytes, signature_header: str | None, webhook_secret: str
) -> None:
    """Verify the PayMongo HMAC-SHA256 webhook signature header (`Paymongo-Signature`)."""
    secret = webhook_secret.strip()
    if not secret:
        return

    if not signature_header:
        raise AuthenticationError("Missing Paymongo-Signature header.")

    parts: dict[str, str] = {}
    for segment in signature_header.split(","):
        if "=" in segment:
            key, val = segment.split("=", 1)
            parts[key.strip()] = val.strip()

    timestamp = parts.get("t")
    test_sig = parts.get("te")
    live_sig = parts.get("li")

    if not timestamp or (not test_sig and not live_sig):
        raise AuthenticationError("Malformed Paymongo-Signature header.")

    signed_payload = f"{timestamp}.{raw_body.decode('utf-8')}"
    expected = hmac.new(
        secret.encode("utf-8"),
        signed_payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    matched = False
    if test_sig and hmac.compare_digest(expected, test_sig):
        matched = True
    if live_sig and hmac.compare_digest(expected, live_sig):
        matched = True

    if not matched:
        raise AuthenticationError("Invalid PayMongo webhook signature.")


async def _paymongo_post(
    client: httpx.AsyncClient, path: str, attributes: dict[str, Any]
) -> dict[str, Any]:
    response = await client.post(
        f"{PAYMONGO_BASE_URL}{path}",
        headers=_auth_headers(),
        json={"data": {"attributes": attributes}},
    )
    response.raise_for_status()
    return response.json()["data"]


async def _paymongo_get(client: httpx.AsyncClient, path: str) -> dict[str, Any]:
    response = await client.get(f"{PAYMONGO_BASE_URL}{path}", headers=_auth_headers())
    response.raise_for_status()
    return response.json()["data"]


async def _open_qrph_intent(
    transaction: Transaction, payment: Payment, table: Table
) -> str:
    """Create a QR Ph payment intent for this share and return its id."""
    centavos = int((payment.amount * Decimal("100")).to_integral_value())
    async with httpx.AsyncClient(timeout=10.0) as client:
        intent = await _paymongo_post(
            client,
            "/payment_intents",
            {
                "amount": centavos,
                "currency": "PHP",
                "payment_method_allowed": ["qrph"],
                "description": (
                    f"Shaxian Snacks · Table {table.table_number} · "
                    f"Order Q-{transaction.queue_number:03d}"
                ),
                "statement_descriptor": "Shaxian Snacks",
                "metadata": {
                    "txn_id": str(transaction.txn_id),
                    "payment_id": str(payment.payment_id),
                    "session_id": str(transaction.session_id),
                    "queue_number": f"Q-{transaction.queue_number:03d}",
                },
            },
        )
        method = await _paymongo_post(client, "/payment_methods", {"type": "qrph"})
        await _paymongo_post(
            client,
            f"/payment_intents/{intent['id']}/attach",
            {"payment_method": method["id"]},
        )
    return intent["id"]


# Create
async def initiate_online_payment(
    db: AsyncSession,
    transaction: Transaction,
    payment: Payment,
    origin_url: str | None = None,
    channel: str = "checkout",
) -> tuple[str | None, bool]:
    """Start an online payment. Returns (hosted checkout url, fell back to cashier).

    The "qrph" channel returns no url: the receipt page shows the QR itself and
    watches for the payment, so the diner never has to find their way back.
    """
    if (
        not settings.PAYMONGO_SECRET_KEY
        or payment.amount < MIN_ONLINE_AMOUNT
    ):
        payment.method = PaymentMethod.CASHIER
        payment.status = PaymentStatus.PENDING
        payment.aggregator_ref = "CASHIER-FALLBACK"
        await db.commit()
        return None, True

    ordering_session = await db.get(Session, transaction.session_id)
    table = await db.get(Table, ordering_session.table_id)

    if channel == "qrph":
        try:
            payment.aggregator_ref = await _open_qrph_intent(transaction, payment, table)
            payment.status = PaymentStatus.PENDING
            await db.commit()
            return None, False
        except Exception as exc:  # noqa: BLE001
            logger.warning("PayMongo QR Ph unavailable (%s); falling back to cashier", exc)
            payment.method = PaymentMethod.CASHIER
            payment.status = PaymentStatus.PENDING
            payment.aggregator_ref = "OFFLINE-FALLBACK"
            await db.commit()
            return None, True
    base_url = (origin_url or settings.FRONTEND_BASE_URL).strip().rstrip("/")

    # Read
    device = await db.get(SessionDevice, payment.device_id) if payment.device_id else None
    device_token_param = f"&device_token={device.device_token}" if device else ""

    centavos = int((payment.amount * Decimal("100")).to_integral_value())
    receipt_base = (
        f"{base_url}/t/{table.qr_token}/receipt"
        f"?txn_id={transaction.txn_id}&payment_id={payment.payment_id}"
        f"{device_token_param}"
    )

    payload = {
        "data": {
            "attributes": {
                "send_email_receipt": False,
                "show_description": True,
                "show_line_items": True,
                "description": (
                    f"Shaxian Snacks · Table {table.table_number} · "
                    f"Order Q-{transaction.queue_number:03d}"
                ),
                "payment_method_types": ["gcash", "paymaya", "card"],
                "success_url": f"{receipt_base}&verify=1",
                "cancel_url": f"{receipt_base}&cancelled=1",
                "metadata": {
                    "txn_id": str(transaction.txn_id),
                    "payment_id": str(payment.payment_id),
                    "session_id": str(transaction.session_id),
                    "queue_number": f"Q-{transaction.queue_number:03d}",
                },
                "line_items": [
                    {
                        "currency": "PHP",
                        "amount": centavos,
                        "name": (
                            f"Order Q-{transaction.queue_number:03d} "
                            f"(Table {table.table_number})"
                        ),
                        "quantity": 1,
                    }
                ],
            }
        }
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.post(
                f"{PAYMONGO_BASE_URL}/checkout_sessions",
                headers=_auth_headers(),
                json=payload,
            )
            response.raise_for_status()
            data = response.json()["data"]
            payment.aggregator_ref = data["id"]
            payment.status = PaymentStatus.PENDING
            await db.commit()
            return data["attributes"]["checkout_url"], False
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "PayMongo checkout unavailable (%s); falling back to cashier", exc
        )
        payment.method = PaymentMethod.CASHIER
        payment.status = PaymentStatus.PENDING
        payment.aggregator_ref = "OFFLINE-FALLBACK"
        await db.commit()
        return None, True


async def _finalize_paid_transaction(
    db: AsyncSession, transaction: Transaction, all_payments: list[Payment]
) -> None:
    if all(p.status is PaymentStatus.PAID for p in all_payments):
        existing_slot = await db.scalar(
            select(KitchenQueue).where(KitchenQueue.txn_id == transaction.txn_id)
        )
        if existing_slot is None:
            await queue_service.place_in_queue(db, transaction)

    # Commit
    await db.commit()
    await events.publish_status(transaction)
    await events.publish_cart_changed(transaction.session_id)

    if all(p.status is PaymentStatus.PAID for p in all_payments):
        try:
            await pos_service.transmit(
                db, transaction.txn_id, settings.POS_ENDPOINT, staff_id=None
            )
        except Exception:  # noqa: BLE001
            logger.exception("POS transmission failed for online txn %s", transaction.txn_id)

        closed = await session_service.close_if_settled(db, transaction.session_id)
        if closed is not None:
            await events.publish_session_ended(closed)


async def _unpaid_due(db: AsyncSession, txn_id: int) -> Decimal:
    payments = list(await db.scalars(select(Payment).where(Payment.txn_id == txn_id)))
    if not payments:
        raise NotFoundError("That order has no payment record.")
    return sum(
        (p.amount for p in payments if p.status is not PaymentStatus.PAID), Decimal("0.00")
    )


# Update
async def settle_at_counter(
    db: AsyncSession, txn_id: int, staff_id: str, settlement: SettlementWrite
) -> CounterSettlement:
    """One tap at the counter: check every ID, take the money, and send the slip to the register.

    The cash is checked against the amount the ID checks will leave owing before anything
    is written, so a short tender changes nothing.
    """
    transaction = await db.get(Transaction, txn_id)
    if transaction is None:
        raise NotFoundError("That order no longer exists. Refresh the queue.")

    claims = (await verification_service.pending_checks(db, [transaction])).get(txn_id, [])
    checks = {check.log_id: check for check in settlement.checks}
    if any(claim.log_id not in checks for claim in claims):
        raise BusinessRuleError("Check the senior or PWD ID before confirming payment.")
    if set(checks) - {claim.log_id for claim in claims}:
        raise BusinessRuleError(
            "That ID check is no longer waiting on this order. Refresh the queue."
        )

    due = await _unpaid_due(db, txn_id)
    if due <= Decimal("0.00"):
        raise BusinessRuleError(f"Order Q-{transaction.queue_number:03d} is already marked paid.")

    # Validate
    items = list(
        await db.scalars(select(TransactionItem).where(TransactionItem.txn_id == txn_id))
    )
    for claim in claims:
        if_valid, if_invalid = verification_service.price_deltas(items, claim.device_id)
        due += if_valid if checks[claim.log_id].discount_eligible else if_invalid
    pos_service.tendered_amount(settlement.tender, settlement.cash_tendered, due)

    for claim in claims:
        check = checks[claim.log_id]
        await verification_service.record_check(
            db, txn_id, claim.log_id, staff_id, check.discount_eligible, check
        )

    due = await _unpaid_due(db, txn_id)
    tendered = pos_service.tendered_amount(settlement.tender, settlement.cash_tendered, due)
    transaction = await queue_service.confirm_counter_payment(
        db, txn_id, staff_id, settlement.tender
    )

    transmission: pos_service.Transmission | None = None
    try:
        transmission = await pos_service.transmit(
            db,
            txn_id,
            settings.POS_ENDPOINT,
            staff_id=staff_id,
            cash_tendered=tendered,
            change_due=tendered - due,
            tender=settlement.tender,
        )
    except Exception:  # noqa: BLE001
        logger.exception("POS transmission failed for txn %s", txn_id)

    closed = await session_service.close_if_settled(db, transaction.session_id)
    return CounterSettlement(
        transaction=transaction,
        tender=settlement.tender,
        tendered=tendered,
        change_due=tendered - due,
        transmission=transmission,
        closed=closed,
    )


# Update
async def verify_online_payment(
    db: AsyncSession, txn_id: int, device_id: int | None = None
) -> list[Payment]:
    transaction = await db.get(Transaction, txn_id)
    if transaction is None:
        raise NotFoundError("That order no longer exists.")

    all_payments = list(
        await db.scalars(
            select(Payment)
            .where(Payment.txn_id == txn_id)
            .order_by(Payment.payment_id.asc())
        )
    )
    if not all_payments:
        raise NotFoundError("That order has no payment record.")

    candidates = [
        p
        for p in all_payments
        if p.status != PaymentStatus.PAID
        and p.method is PaymentMethod.ONLINE
        and p.aggregator_ref
        and p.aggregator_ref.startswith((CHECKOUT_PREFIX, QRPH_PREFIX))
    ]
    if device_id is not None:
        dev_candidates = [p for p in candidates if p.device_id == device_id]
        if dev_candidates:
            candidates = dev_candidates

    if not candidates or not settings.PAYMONGO_SECRET_KEY:
        return all_payments

    any_newly_paid = False
    async with httpx.AsyncClient(timeout=8.0) as client:
        for payment in candidates:
            try:
                if payment.aggregator_ref.startswith(QRPH_PREFIX):
                    intent = await _paymongo_get(
                        client, f"/payment_intents/{payment.aggregator_ref}"
                    )
                    is_paid = intent["attributes"].get("status") == "succeeded"
                else:
                    session = await _paymongo_get(
                        client, f"/checkout_sessions/{payment.aggregator_ref}"
                    )
                    attrs = session["attributes"]
                    payments_arr = attrs.get("payments") or []
                    intent_status = (
                        (attrs.get("payment_intent") or {})
                        .get("attributes", {})
                        .get("status")
                    )
                    is_paid = intent_status == "succeeded" or any(
                        p.get("attributes", {}).get("status") == "paid"
                        for p in payments_arr
                    )
                if is_paid:
                    payment.status = PaymentStatus.PAID
                    payment.paid_at = datetime.now(UTC)
                    payment.print_status = PrintStatus.SUCCESS
                    any_newly_paid = True
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "PayMongo verification failed for payment %s: %s",
                    payment.payment_id,
                    exc,
                )

    if any_newly_paid:
        await _finalize_paid_transaction(db, transaction, all_payments)

    return all_payments


def is_qrph(payment: Payment | None) -> bool:
    return bool(
        payment
        and payment.method is PaymentMethod.ONLINE
        and payment.aggregator_ref
        and payment.aggregator_ref.startswith(QRPH_PREFIX)
    )


def _parse_expiry(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None


# Read
async def qrph_code(db: AsyncSession, txn_id: int, device_id: int) -> dict[str, Any]:
    """The QR Ph code for this phone's share, settling it first if the scan already went through.

    A QR Ph code lives for 30 minutes. Once it lapses unpaid, a fresh intent replaces it
    so the diner can still pay without going back to the counter.
    """
    all_payments = await verify_online_payment(db, txn_id, device_id=device_id)
    payment = next((p for p in all_payments if p.device_id == device_id), None)
    if payment is None or not is_qrph(payment):
        raise NotFoundError("This order has no QR Ph payment for your phone.")

    result: dict[str, Any] = {
        "payment_id": payment.payment_id,
        "status": payment.status,
        "amount": payment.amount,
    }
    if payment.status is PaymentStatus.PAID:
        return result

    async with httpx.AsyncClient(timeout=8.0) as client:
        intent = await _paymongo_get(client, f"/payment_intents/{payment.aggregator_ref}")
    attrs = intent["attributes"]
    code = (attrs.get("next_action") or {}).get("code") or {}
    expires_at = _parse_expiry(code.get("expires_at"))

    lapsed = (
        attrs.get("status") == "awaiting_payment_method"
        or not code.get("image_url")
        or (expires_at is not None and expires_at <= datetime.now(UTC))
    )
    if lapsed:
        transaction = await db.get(Transaction, txn_id)
        ordering_session = await db.get(Session, transaction.session_id)
        table = await db.get(Table, ordering_session.table_id)
        payment.aggregator_ref = await _open_qrph_intent(transaction, payment, table)
        await db.commit()
        async with httpx.AsyncClient(timeout=8.0) as client:
            intent = await _paymongo_get(client, f"/payment_intents/{payment.aggregator_ref}")
        code = (intent["attributes"].get("next_action") or {}).get("code") or {}
        expires_at = _parse_expiry(code.get("expires_at"))

    result.update(
        image_url=code.get("image_url"),
        expires_at=expires_at,
        test_url=None if attrs.get("livemode") else code.get("test_url"),
    )
    return result


# Update
async def process_paymongo_webhook(
    db: AsyncSession,
    raw_body: bytes,
    signature_header: str | None = None,
) -> dict[str, Any]:
    """Verify and process an incoming PayMongo webhook event (`checkout_session.payment.paid`, `payment.paid`, `payment.failed`)."""
    verify_paymongo_signature(
        raw_body, signature_header, settings.PAYMONGO_WEBHOOK_SECRET
    )

    try:
        envelope = json.loads(raw_body.decode("utf-8"))
    except Exception as exc:  # noqa: BLE001
        raise BusinessRuleError("Malformed JSON webhook payload.") from exc

    event_data = envelope.get("data") or {}
    event_attrs = event_data.get("attributes") or {}
    event_type = str(event_attrs.get("type") or "")
    resource = event_attrs.get("data") or {}
    resource_id = str(resource.get("id") or "")
    resource_attrs = resource.get("attributes") or {}

    metadata = resource_attrs.get("metadata") or {}
    if not metadata:
        payments_list = resource_attrs.get("payments") or []
        for p_entry in payments_list:
            p_meta = (p_entry.get("attributes") or {}).get("metadata")
            if p_meta:
                metadata = p_meta
                break

    payment: Payment | None = None
    if resource_id.startswith(CHECKOUT_PREFIX):
        payment = await db.scalar(
            select(Payment).where(Payment.aggregator_ref == resource_id)
        )

    # A QR Ph payment arrives as a "pay_" resource that names its payment intent.
    intent_id = str(resource_attrs.get("payment_intent_id") or "")
    if payment is None and intent_id.startswith(QRPH_PREFIX):
        payment = await db.scalar(
            select(Payment).where(Payment.aggregator_ref == intent_id)
        )

    if payment is None and metadata.get("payment_id"):
        try:
            payment = await db.get(Payment, int(metadata["payment_id"]))
        except (TypeError, ValueError):
            payment = None

    if payment is None and metadata.get("txn_id"):
        try:
            txn_id_meta = int(metadata["txn_id"])
            payment = await db.scalar(
                select(Payment)
                .where(Payment.txn_id == txn_id_meta)
                .order_by(Payment.payment_id.asc())
            )
        except (TypeError, ValueError):
            payment = None

    if payment is None:
        return {
            "received": True,
            "matched": False,
            "event_type": event_type,
        }

    transaction = await db.get(Transaction, payment.txn_id)
    if transaction is None:
        return {
            "received": True,
            "matched": False,
            "event_type": event_type,
        }

    all_payments = list(
        await db.scalars(
            select(Payment)
            .where(Payment.txn_id == transaction.txn_id)
            .order_by(Payment.payment_id.asc())
        )
    )

    is_paid_event = event_type in (
        "checkout_session.payment.paid",
        "payment.paid",
    )
    is_failed_event = event_type == "payment.failed"

    now = datetime.now(UTC)
    if is_paid_event and payment.status is not PaymentStatus.PAID:
        old_status = payment.status.value
        payment.status = PaymentStatus.PAID
        payment.paid_at = now
        payment.print_status = PrintStatus.SUCCESS
        if resource_id and not payment.aggregator_ref:
            payment.aggregator_ref = resource_id

        db.add(
            AuditLog(
                staff_id=None,
                action="paymongo_webhook",
                entity_type="payment",
                entity_id=str(payment.payment_id),
                before_state={"status": old_status},
                after_state={
                    "status": PaymentStatus.PAID.value,
                    "event_type": event_type,
                    "txn_id": transaction.txn_id,
                },
            )
        )
        await _finalize_paid_transaction(db, transaction, all_payments)
    elif is_failed_event and payment.status is PaymentStatus.PENDING:
        old_status = payment.status.value
        payment.status = PaymentStatus.FAILED
        db.add(
            AuditLog(
                staff_id=None,
                action="paymongo_webhook",
                entity_type="payment",
                entity_id=str(payment.payment_id),
                before_state={"status": old_status},
                after_state={
                    "status": PaymentStatus.FAILED.value,
                    "event_type": event_type,
                    "txn_id": transaction.txn_id,
                },
            )
        )
        await db.commit()
        await events.publish_status(transaction)

    return {
        "received": True,
        "matched": True,
        "event_type": event_type,
        "txn_id": transaction.txn_id,
        "payment_id": payment.payment_id,
        "status": payment.status.value,
    }
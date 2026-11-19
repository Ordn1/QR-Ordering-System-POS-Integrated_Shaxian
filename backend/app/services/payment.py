import base64
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
)
from app.models.enums import PaymentMethod, PaymentStatus, PrintStatus
from app.services import pos as pos_service
from app.services import queue as queue_service
from app.websocket import events

logger = logging.getLogger(__name__)

PAYMONGO_BASE_URL = "https://api.paymongo.com/v1"
MIN_ONLINE_AMOUNT = Decimal("20.00")


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


# Create
async def initiate_online_payment(
    db: AsyncSession,
    transaction: Transaction,
    payment: Payment,
    origin_url: str | None = None,
) -> tuple[str | None, bool]:
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
                "payment_method_types": ["gcash", "paymaya", "card", "qrph"],
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
        and p.aggregator_ref.startswith("cs_")
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
                response = await client.get(
                    f"{PAYMONGO_BASE_URL}/checkout_sessions/{payment.aggregator_ref}",
                    headers=_auth_headers(),
                )
                response.raise_for_status()
                attrs = response.json()["data"]["attributes"]

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
    if resource_id.startswith("cs_"):
        payment = await db.scalar(
            select(Payment).where(Payment.aggregator_ref == resource_id)
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
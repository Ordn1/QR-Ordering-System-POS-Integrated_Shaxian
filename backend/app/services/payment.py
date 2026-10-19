import base64
import logging
from datetime import UTC, datetime
from decimal import Decimal

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import NotFoundError
from app.models import KitchenQueue, Payment, Session, SessionDevice, Table, Transaction
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
        # Update
        if all(p.status is PaymentStatus.PAID for p in all_payments):
            existing_slot = await db.scalar(
                select(KitchenQueue).where(KitchenQueue.txn_id == txn_id)
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
                    db, txn_id, settings.POS_ENDPOINT, staff_id=None
                )
            except Exception:  # noqa: BLE001
                logger.exception("POS transmission failed for online txn %s", txn_id)

    return all_payments
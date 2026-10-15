import base64
import logging
from datetime import UTC, datetime
from decimal import Decimal

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import NotFoundError
from app.models import Payment, Session, Table, Transaction
from app.models.enums import PaymentMethod, PaymentStatus, PrintStatus
from app.services import pos as pos_service
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
    origin_url: str | None = None,
    device_token: str | None = None,
) -> tuple[str | None, bool]:
    payment = await db.scalar(
        select(Payment).where(Payment.txn_id == transaction.txn_id)
    )
    if payment is None:
        raise NotFoundError("That order has no payment record.")

    if (
        not settings.PAYMONGO_SECRET_KEY
        or transaction.net_amount < MIN_ONLINE_AMOUNT
    ):
        payment.method = PaymentMethod.CASHIER
        payment.status = PaymentStatus.PENDING
        payment.aggregator_ref = "CASHIER-FALLBACK"
        await db.commit()
        return None, True

    ordering_session = await db.get(Session, transaction.session_id)
    table = await db.get(Table, ordering_session.table_id)
    base_url = (origin_url or settings.FRONTEND_BASE_URL).strip().rstrip("/")

    centavos = int((transaction.net_amount * Decimal("100")).to_integral_value())
    receipt_base = f"{base_url}/t/{table.qr_token}/receipt?txn_id={transaction.txn_id}"
    # Embed the device token so the SPA can restore the session after a
    # full-page redirect back from PayMongo without creating a phantom device.
    device_suffix = f"&device={device_token}" if device_token else ""

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
                "success_url": f"{receipt_base}&verify=1{device_suffix}",
                "cancel_url": f"{receipt_base}&cancelled=1{device_suffix}",
                "metadata": {
                    "txn_id": str(transaction.txn_id),
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
async def verify_online_payment(db: AsyncSession, txn_id: int) -> Payment:
    transaction = await db.get(Transaction, txn_id)
    if transaction is None:
        raise NotFoundError("That order no longer exists.")

    payment = await db.scalar(select(Payment).where(Payment.txn_id == txn_id))
    if payment is None:
        raise NotFoundError("That order has no payment record.")

    if payment.status is PaymentStatus.PAID:
        return payment

    if (
        payment.method is not PaymentMethod.ONLINE
        or not payment.aggregator_ref
        or not payment.aggregator_ref.startswith("cs_")
        or not settings.PAYMONGO_SECRET_KEY
    ):
        return payment

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                f"{PAYMONGO_BASE_URL}/checkout_sessions/{payment.aggregator_ref}",
                headers=_auth_headers(),
            )
            response.raise_for_status()
            attrs = response.json()["data"]["attributes"]

            payments = attrs.get("payments") or []
            intent_status = (
                (attrs.get("payment_intent") or {})
                .get("attributes", {})
                .get("status")
            )
            is_paid = intent_status == "succeeded" or any(
                p.get("attributes", {}).get("status") == "paid" for p in payments
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning("PayMongo verification failed for txn %s: %s", txn_id, exc)
        return payment

    if is_paid:
        payment.status = PaymentStatus.PAID
        payment.paid_at = datetime.now(UTC)
        payment.print_status = PrintStatus.SUCCESS
        await db.commit()
        await db.refresh(payment)

        await events.publish_status(transaction)
        try:
            await pos_service.transmit(
                db, txn_id, settings.POS_ENDPOINT, staff_id=None
            )
        except Exception:  # noqa: BLE001
            logger.exception("POS transmission failed for online txn %s", txn_id)

    return payment
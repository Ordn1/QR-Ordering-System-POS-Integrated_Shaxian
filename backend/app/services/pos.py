import hashlib
import json
import re
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessRuleError, NotFoundError
from app.models import (
    AuditLog,
    MenuItem,
    Payment,
    PriorityVerificationLog,
    Session,
    SessionDevice,
    Table,
    Transaction,
    TransactionItem,
)
from app.models.enums import (
    Language,
    OccupancyStatus,
    PaymentMethod,
    PaymentStatus,
    PriorityStatus,
    PrintStatus,
    SessionType,
    UiMode,
)
from app.schemas.pos import PosOrderCreate
from app.services import order as order_service
from app.services import queue as queue_service

STORE_CODE = "SXN-SASA-01"
TERMINAL_CODE = "REG-01"
ACTION = "pos_transmit"
ENTITY = "pos_transmission"
MAX_ATTEMPTS = 3
TIMEOUT_SECONDS = 5.0


@dataclass(frozen=True)
class Transmission:
    txn_id: int
    queue_number: int
    status: str
    attempts: int
    latency_ms: int
    receipt_no: str | None
    detail: str | None
    payload: dict[str, Any]
    occurred_at: str


def _money(value: Decimal) -> str:
    """Amounts cross the wire as fixed-point strings — never as floats."""
    return f"{Decimal(value):.2f}"


# Create
async def create_counter_order(
    db: AsyncSession,
    payload: PosOrderCreate,
    staff_id: str,
    endpoint: str,
) -> tuple[Transaction, Transmission]:
    """Ring up a direct counter / waiter POS order, place it in the kitchen queue, and issue an OR."""
    table = await db.get(Table, payload.table_id)
    if table is None or not table.is_active:
        raise NotFoundError("Selected table was not found.")

    declared = payload.declared_priority_status
    discount_eligible = declared in (PriorityStatus.SENIOR, PriorityStatus.PWD)

    if discount_eligible:
        last4 = (payload.id_last4 or "").strip()
        holder = (payload.cardholder_name or "").strip()
        lgu = (payload.issuing_lgu or "").strip()
        if not re.match(r"^[0-9]{4}$", last4):
            raise BusinessRuleError("Enter the last 4 digits of the Senior/PWD ID card.")
        if len(holder) < 2:
            raise BusinessRuleError("Enter the cardholder name from the Senior/PWD ID card.")
        if len(lgu) < 2:
            raise BusinessRuleError("Enter the issuing LGU from the Senior/PWD ID card.")

    item_ids = [line.item_id for line in payload.items]
    items_map = {
        item.item_id: item
        for item in await db.scalars(
            select(MenuItem).where(MenuItem.item_id.in_(item_ids))
        )
    }

    cart_lines: list[order_service.CartLine] = []
    for line in payload.items:
        item = items_map.get(line.item_id)
        if item is None:
            raise NotFoundError("One of the selected menu items does not exist.")
        if not item.is_available:
            raise BusinessRuleError(f"{item.name_en} is currently marked sold out.")
        cart_lines.append(
            order_service.CartLine(
                item_id=item.item_id,
                quantity=line.quantity,
                unit_price=item.price,
                discount_eligible=discount_eligible,
                device_id=None,
            )
        )

    priced = order_service.price_order(cart_lines)
    if payload.cash_tendered < priced.net_amount:
        raise BusinessRuleError(
            f"Cash tendered (₱{payload.cash_tendered:.2f}) is less than amount due (₱{priced.net_amount:.2f})."
        )

    change_due = payload.cash_tendered - priced.net_amount
    now = datetime.now(UTC)

    ordering_session = Session(
        table_id=table.table_id,
        started_at=now,
        declared_priority_status=declared,
        session_type=(
            SessionType.PRIORITY
            if declared is not PriorityStatus.STANDARD
            else SessionType.STANDARD
        ),
        group_mode=False,
        ui_mode_used=(
            UiMode.ACCESSIBLE
            if declared is not PriorityStatus.STANDARD
            else UiMode.STANDARD
        ),
        language_used=Language.EN,
        accessibility_accepted=declared is not PriorityStatus.STANDARD,
    )
    db.add(ordering_session)
    await db.flush()

    device = SessionDevice(
        session_id=ordering_session.session_id,
        display_name="Counter POS",
        is_host=True,
    )
    db.add(device)
    table.occupancy_status = OccupancyStatus.OCCUPIED
    await db.flush()

    if declared is not PriorityStatus.STANDARD:
        db.add(
            PriorityVerificationLog(
                session_id=ordering_session.session_id,
                declared_status=declared,
                id_presented=discount_eligible,
                id_last4=(payload.id_last4 or "").strip() if discount_eligible else None,
                cardholder_name=(payload.cardholder_name or "").strip() if discount_eligible else None,
                issuing_lgu=(payload.issuing_lgu or "").strip() if discount_eligible else None,
                verified_by=staff_id if discount_eligible else None,
                verified_at=now if discount_eligible else None,
                discount_eligible=discount_eligible,
            )
        )

    queue_number = await order_service.next_queue_number(db)
    transaction = Transaction(
        session_id=ordering_session.session_id,
        placed_at=now,
        gross_amount=priced.gross_amount,
        vatable_sales=priced.vatable_sales,
        vat_exempt_sales=priced.vat_exempt_sales,
        vat_amount=priced.vat_amount,
        discount_amount=priced.discount_amount,
        net_amount=priced.net_amount,
        item_count=priced.item_count,
        is_priority=declared is not PriorityStatus.STANDARD,
        queue_number=queue_number,
    )
    db.add(transaction)
    await db.flush()

    db.add_all(
        TransactionItem(
            txn_id=transaction.txn_id,
            item_id=line.item_id,
            device_id=device.device_id,
            quantity=line.quantity,
            unit_price=line.unit_price,
            subtotal=line.subtotal,
            is_discounted=line.is_discounted,
            discount_amount=line.discount_amount,
        )
        for line in priced.lines
    )

    await queue_service.place_in_queue(db, transaction)

    db.add(
        Payment(
            txn_id=transaction.txn_id,
            device_id=device.device_id,
            method=PaymentMethod.CASHIER,
            amount=priced.net_amount,
            discount_applied=priced.discount_amount,
            aggregator_ref="POS-COUNTER",
            status=PaymentStatus.PAID,
            print_status=PrintStatus.SUCCESS,
            paid_at=now,
        )
    )

    # Commit
    await db.commit()
    await db.refresh(transaction)

    tx_result = await transmit(
        db,
        transaction.txn_id,
        endpoint,
        staff_id=staff_id,
        cash_tendered=payload.cash_tendered,
        change_due=change_due,
    )
    return transaction, tx_result


async def build_payload(
    db: AsyncSession,
    txn_id: int,
    cash_tendered: Decimal | None = None,
    change_due: Decimal | None = None,
) -> dict[str, Any]:
    """Compile one transaction into the register's expected shape."""
    transaction = await db.get(Transaction, txn_id)
    if transaction is None:
        raise NotFoundError("That order no longer exists.")

    ordering_session = await db.get(Session, transaction.session_id)
    table = await db.get(Table, ordering_session.table_id)
    payment = await db.scalar(select(Payment).where(Payment.txn_id == txn_id))

    rows = await db.execute(
        select(TransactionItem, MenuItem)
        .join(MenuItem, MenuItem.item_id == TransactionItem.item_id)
        .where(TransactionItem.txn_id == txn_id)
        .order_by(TransactionItem.txi_id)
    )

    lines = [
        {
            "item_code": item.item_id,
            "description": item.name_en,
            "quantity": line.quantity,
            "unit_price": _money(line.unit_price),
            "subtotal": _money(line.subtotal),
            "discounted": line.is_discounted,
        }
        for line, item in rows.all()
    ]

    effective_tendered = (
        cash_tendered if cash_tendered is not None else transaction.net_amount
    )
    effective_change = (
        change_due
        if change_due is not None
        else max(Decimal("0.00"), effective_tendered - transaction.net_amount)
    )

    base_for_hash = {
        "store_code": STORE_CODE,
        "terminal_code": TERMINAL_CODE,
        "txn_id": transaction.txn_id,
        "queue_date": transaction.queue_date.isoformat(),
        "queue_number": transaction.queue_number,
        "table_number": table.table_number,
        "placed_at": transaction.placed_at.isoformat(),
        "priority_status": ordering_session.declared_priority_status.value,
        "lines": lines,
        "totals": {
            "gross": _money(transaction.gross_amount),
            "vatable_sales": _money(transaction.vatable_sales),
            "vat_exempt_sales": _money(transaction.vat_exempt_sales),
            "vat": _money(transaction.vat_amount),
            "statutory_discount": _money(transaction.discount_amount),
            "net": _money(transaction.net_amount),
        },
    }

    payload = {
        **base_for_hash,
        "payment": {
            "method": payment.method.value if payment else None,
            "status": payment.status.value if payment else None,
            "cash_tendered": _money(effective_tendered),
            "change_due": _money(effective_change),
        },
        "idempotency_key": hashlib.sha256(
            json.dumps(base_for_hash, sort_keys=True).encode()
        ).hexdigest()[:32],
    }
    return payload


async def transmit(
    db: AsyncSession,
    txn_id: int,
    endpoint: str,
    staff_id: str | None = None,
    cash_tendered: Decimal | None = None,
    change_due: Decimal | None = None,
) -> Transmission:
    """Push one transaction to the register, retrying, and record the attempt."""
    payload = await build_payload(
        db, txn_id, cash_tendered=cash_tendered, change_due=change_due
    )

    status = "failed"
    receipt_no: str | None = None
    detail: str | None = None
    attempts = 0
    started = time.perf_counter()

    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
        while attempts < MAX_ATTEMPTS:
            attempts += 1
            try:
                response = await client.post(endpoint, json=payload)
                response.raise_for_status()
                ack = response.json()
                status = "acknowledged"
                receipt_no = ack.get("receipt_no")
                break
            except Exception as error:  # noqa: BLE001
                detail = f"{type(error).__name__}: {error}"[:200]

    latency_ms = int((time.perf_counter() - started) * 1000)

    db.add(
        AuditLog(
            staff_id=staff_id,
            action=ACTION,
            entity_type=ENTITY,
            entity_id=str(txn_id),
            after_state={
                "status": status,
                "attempts": attempts,
                "latency_ms": latency_ms,
                "receipt_no": receipt_no,
                "detail": detail,
                "endpoint": endpoint,
                "payload": payload,
            },
        )
    )
    await db.commit()

    return Transmission(
        txn_id=txn_id,
        queue_number=payload["queue_number"],
        status=status,
        attempts=attempts,
        latency_ms=latency_ms,
        receipt_no=receipt_no,
        detail=detail,
        payload=payload,
        occurred_at=datetime.now(UTC).isoformat(),
    )


async def transmissions(db: AsyncSession, limit: int = 100) -> list[dict[str, Any]]:
    """The transmission log, newest first."""
    rows = await db.scalars(
        select(AuditLog)
        .where(AuditLog.action == ACTION)
        .order_by(AuditLog.audit_id.desc())
        .limit(limit)
    )
    out = []
    for entry in rows.all():
        state = entry.after_state or {}
        payload = state.get("payload", {})
        out.append(
            {
                "audit_id": entry.audit_id,
                "txn_id": int(entry.entity_id) if entry.entity_id else None,
                "queue_number": payload.get("queue_number"),
                "table_number": payload.get("table_number"),
                "status": state.get("status", "failed"),
                "attempts": state.get("attempts", 0),
                "latency_ms": state.get("latency_ms", 0),
                "receipt_no": state.get("receipt_no"),
                "detail": state.get("detail"),
                "payload_bytes": len(json.dumps(payload)),
                "payload": payload,
                "occurred_at": entry.occurred_at.isoformat(),
            }
        )
    return out
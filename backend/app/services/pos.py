"""POS integration layer — objective 1.3.2.5.

Compiles a settled transaction into a validated payload and transmits it over the
local network to the restaurant's register, so the counter does not have to re-key
an order the QR system already holds.

Everything on this side is real: payload construction, validation, transmission,
acknowledgement, retry and the audit record. The **receiving terminal is
simulated** — `routers/pos.py` exposes a register inbox that validates and
acknowledges — because the partner restaurant's POS schema is undocumented and
there is no real endpoint to integrate against. Swapping the simulated register
for a real one is a change of `POS_ENDPOINT`, not a change of design.
"""

import hashlib
import json
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models import (
    AuditLog,
    MenuItem,
    Payment,
    Session,
    Table,
    Transaction,
    TransactionItem,
)

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


async def build_payload(db: AsyncSession, txn_id: int) -> dict[str, Any]:
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

    payload = {
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
        "payment": {
            "method": payment.method.value if payment else None,
            "status": payment.status.value if payment else None,
        },
    }
    # Derived from content, so a retry of the same order cannot double-post.
    payload["idempotency_key"] = hashlib.sha256(
        json.dumps(payload, sort_keys=True).encode()
    ).hexdigest()[:32]
    return payload


async def transmit(
    db: AsyncSession, txn_id: int, endpoint: str, staff_id: str | None = None
) -> Transmission:
    """Push one transaction to the register, retrying, and record the attempt."""
    payload = await build_payload(db, txn_id)

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
            except Exception as error:  # noqa: BLE001 — any failure is a failed push
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

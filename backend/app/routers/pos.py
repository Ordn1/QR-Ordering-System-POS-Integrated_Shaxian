"""POS bridge endpoints.

`/pos/transmit` and `/pos/transmissions` are the integration layer proper.
`/pos/register/*` is the **simulated register** standing in for the counter
terminal, because the partner restaurant's POS schema is undocumented. It is a
real HTTP endpoint doing real validation — it is simply hosted here rather than on
the register, so the transmission path is exercised end to end.
"""

from typing import Any

from fastapi import APIRouter

from app.config import settings
from app.core.deps import AdminStaff, CurrentStaff, DbSession
from app.core.exceptions import BusinessRuleError
from app.schemas.pos import (
    BridgeStatus,
    RegisterAck,
    TransmissionRead,
    TransmitResult,
)
from app.services import pos as pos_service

router = APIRouter(prefix="/api/v1/pos", tags=["pos"])

# What the simulated register is holding, keyed by transaction. In a real
# deployment this state lives on the terminal, not here.
_REGISTER: dict[int, dict[str, Any]] = {}


@router.post("/register/inbox", response_model=RegisterAck)
async def register_inbox(payload: dict[str, Any]) -> RegisterAck:
    """The simulated counter register. Validates the payload and acknowledges."""
    required = ("store_code", "txn_id", "queue_number", "lines", "totals", "idempotency_key")
    missing = [field for field in required if field not in payload]
    if missing:
        raise BusinessRuleError(f"Register rejected the payload. Missing: {', '.join(missing)}")
    if payload["store_code"] != pos_service.STORE_CODE:
        raise BusinessRuleError("Register rejected the payload. Unknown store code.")

    txn_id = int(payload["txn_id"])
    existing = _REGISTER.get(txn_id)
    if existing and existing["idempotency_key"] == payload["idempotency_key"]:
        # Same content arriving twice is a retry, not a second sale.
        return RegisterAck(receipt_no=existing["receipt_no"], duplicate=True)

    receipt_no = f"OR-{payload['queue_date'].replace('-', '')}-{payload['queue_number']:04d}"
    _REGISTER[txn_id] = {
        "receipt_no": receipt_no,
        "idempotency_key": payload["idempotency_key"],
        "payload": payload,
    }
    return RegisterAck(receipt_no=receipt_no, duplicate=False)


@router.get("/register/{txn_id}")
async def register_record(txn_id: int, staff: CurrentStaff) -> dict[str, Any]:
    """What the simulated register currently holds for one transaction."""
    held = _REGISTER.get(txn_id)
    if held is None:
        return {"held": False}
    return {"held": True, "receipt_no": held["receipt_no"], "payload": held["payload"]}


@router.post("/transmit/{txn_id}", response_model=TransmitResult)
async def transmit(txn_id: int, db: DbSession, staff: CurrentStaff) -> TransmitResult:
    """Push one transaction to the register."""
    result = await pos_service.transmit(
        db, txn_id, settings.POS_ENDPOINT, staff_id=staff.staff_id
    )
    return TransmitResult(**vars(result))


@router.get("/transmissions", response_model=list[TransmissionRead])
async def transmission_log(db: DbSession, staff: AdminStaff) -> list[TransmissionRead]:
    return [TransmissionRead(**row) for row in await pos_service.transmissions(db)]


@router.get("/status", response_model=BridgeStatus)
async def bridge_status(db: DbSession, staff: AdminStaff) -> BridgeStatus:
    rows = await pos_service.transmissions(db)
    acknowledged = [row for row in rows if row["status"] == "acknowledged"]
    return BridgeStatus(
        endpoint=settings.POS_ENDPOINT,
        store_code=pos_service.STORE_CODE,
        terminal_code=pos_service.TERMINAL_CODE,
        simulated=True,
        total=len(rows),
        acknowledged=len(acknowledged),
        last_ack_at=acknowledged[0]["occurred_at"] if acknowledged else None,
        average_latency_ms=(
            round(sum(row["latency_ms"] for row in acknowledged) / len(acknowledged))
            if acknowledged
            else 0
        ),
    )

from typing import Any

from fastapi import APIRouter

from app.config import settings
from app.core.deps import AnyStaff, CurrentStaff, DbSession
from app.core.exceptions import BusinessRuleError
from app.schemas.pos import (
    BridgeStatus,
    PosOrderCreate,
    RegisterAck,
    TransmissionRead,
    TransmitResult,
)
from app.services import pos as pos_service
from app.websocket import events

router = APIRouter(prefix="/api/v1/pos", tags=["pos"])

_REGISTER: dict[int, dict[str, Any]] = {}


@router.post("/orders", response_model=TransmitResult, status_code=201)
async def create_pos_order(
    payload: PosOrderCreate, db: DbSession, staff: AnyStaff
) -> TransmitResult:
    transaction, result = await pos_service.create_counter_order(
        db, payload, staff_id=staff.staff_id, endpoint=settings.POS_ENDPOINT
    )
    await events.publish_new_order(transaction)
    return TransmitResult(**vars(result))


@router.post("/register/inbox", response_model=RegisterAck)
async def register_inbox(payload: dict[str, Any]) -> RegisterAck:
    required = ("store_code", "txn_id", "queue_number", "lines", "totals", "idempotency_key")
    missing = [field for field in required if field not in payload]
    if missing:
        raise BusinessRuleError(f"Register rejected the payload. Missing: {', '.join(missing)}")
    if payload["store_code"] != pos_service.STORE_CODE:
        raise BusinessRuleError("Register rejected the payload. Unknown store code.")

    txn_id = int(payload["txn_id"])
    existing = _REGISTER.get(txn_id)
    if existing and existing["idempotency_key"] == payload["idempotency_key"]:
        _REGISTER[txn_id]["payload"] = payload
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
    held = _REGISTER.get(txn_id)
    if held is None:
        return {"held": False}
    return {"held": True, "receipt_no": held["receipt_no"], "payload": held["payload"]}


@router.post("/transmit/{txn_id}", response_model=TransmitResult)
async def transmit(txn_id: int, db: DbSession, staff: CurrentStaff) -> TransmitResult:
    result = await pos_service.transmit(
        db, txn_id, settings.POS_ENDPOINT, staff_id=staff.staff_id
    )
    return TransmitResult(**vars(result))


@router.get("/transmissions", response_model=list[TransmissionRead])
async def transmission_log(db: DbSession, staff: AnyStaff) -> list[TransmissionRead]:
    return [TransmissionRead(**row) for row in await pos_service.transmissions(db)]


@router.get("/status", response_model=BridgeStatus)
async def bridge_status(db: DbSession, staff: AnyStaff) -> BridgeStatus:
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
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Literal
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import BusinessRuleError, NotFoundError, PermissionError
from app.models import (
    AnalyticsEvent,
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
    EventType,
    Language,
    MenuSize,
    OccupancyStatus,
    PaymentStatus,
    PriorityStatus,
    SessionEndReason,
    SessionType,
    TxnStatus,
    UiMode,
)
from app.schemas.session import DeviceCartLineRead, DeviceShareRead, TableCartRead

OpenMode = Literal["auto", "join", "new"]

DISCOUNTABLE = (PriorityStatus.SENIOR, PriorityStatus.PWD)
DROPPED = (TxnStatus.VOIDED, TxnStatus.ABANDONED)
MAX_COMPANIONS_PER_PHONE = 4
DEFAULT_DISPLAY = {"menu_size": MenuSize.GRID, "is_high_contrast": False, "has_steady_taps": False}
DECLARED_DISPLAY = {"menu_size": MenuSize.LIST, "has_steady_taps": True}
CENTAVO = Decimal("0.01")

_TABLE_CARTS: dict[int, dict[int, list[tuple[str, int]]]] = defaultdict(dict)


def _money(value: Decimal) -> Decimal:
    return value.quantize(CENTAVO, rounding=ROUND_HALF_UP)


def resolve_session_type(declared: PriorityStatus, group_mode: bool) -> SessionType:
    """Apply Database.md §6.1's write rule, where group overrides priority."""
    if group_mode:
        return SessionType.GROUP
    if declared is not PriorityStatus.STANDARD:
        return SessionType.PRIORITY
    return SessionType.STANDARD


@dataclass(frozen=True)
class OpenedSession:
    table: Table
    session: Session | None = None
    device: SessionDevice | None = None
    created: bool = False
    closed: tuple[Session, ...] = ()


@dataclass(frozen=True)
class OrderState:
    placed: bool
    unpaid: bool
    paid: bool
    last_placed: datetime | None


async def open_session(
    db: AsyncSession, qr_token: UUID, device_token: UUID | None, mode: OpenMode = "auto"
) -> OpenedSession:
    """Open, rejoin or join a table session from a scanned QR token.

    A phone outside the table's active session is asked whether it is ordering with
    that table or starting a new order, and is never turned away. An OpenedSession
    without a session means that question has to be answered first.
    """
    # Read
    table = await db.scalar(
        select(Table)
        .where(Table.qr_token == qr_token)
        .with_for_update()
    )
    if table is None or not table.is_active:
        raise NotFoundError("That QR code is not recognised. Ask staff for help.")

    now = datetime.now(UTC)
    active = list(
        await db.scalars(
            select(Session)
            .where(Session.table_id == table.table_id, Session.ended_at.is_(None))
            .order_by(Session.started_at.desc())
        )
    )
    closed = [session for session in active if await _stale(db, session, now)]
    for session in closed:
        await end_session(db, session, SessionEndReason.TIMEOUT, now)
    current = next((session for session in active if session not in closed), None)

    if current is not None and device_token is not None:
        known = await db.scalar(
            select(SessionDevice).where(
                SessionDevice.session_id == current.session_id,
                SessionDevice.device_token == device_token,
                SessionDevice.managed_by_device_id.is_(None),
            )
        )
        if known is not None:
            await db.commit()
            return OpenedSession(table, current, known, closed=tuple(closed))

    if current is not None and mode == "auto":
        await db.commit()
        return OpenedSession(table, closed=tuple(closed))

    if current is not None and mode == "join":
        # Create
        device = SessionDevice(session_id=current.session_id, is_host=False)
        db.add(device)
        current.group_mode = True
        current.session_type = resolve_session_type(current.declared_priority_status, True)
        await db.commit()
        await db.refresh(current)
        await db.refresh(device)
        return OpenedSession(table, current, device, closed=tuple(closed))

    for session in active:
        if session not in closed:
            await end_session(db, session, SessionEndReason.NEW_CUSTOMER_OVERRIDE, now)
            closed.append(session)

    # Create
    session = Session(table_id=table.table_id)
    db.add(session)
    await db.flush()

    device = SessionDevice(session_id=session.session_id, is_host=True)
    db.add(device)
    table.occupancy_status = OccupancyStatus.OCCUPIED
    await db.commit()
    await db.refresh(session)
    await db.refresh(device)
    return OpenedSession(table, session, device, created=True, closed=tuple(closed))


async def end_session(
    db: AsyncSession, session: Session, reason: SessionEndReason, now: datetime | None = None
) -> None:
    """Close a session and free its table, unless another session is still open on it."""
    session.ended_at = now or datetime.now(UTC)
    session.end_reason = reason
    clear_table_cart(session.session_id)
    await db.flush()

    still_open = await db.scalar(
        select(func.count())
        .select_from(Session)
        .where(Session.table_id == session.table_id, Session.ended_at.is_(None))
    )
    table = await db.get(Table, session.table_id)
    if not still_open and table.occupancy_status is OccupancyStatus.OCCUPIED:
        table.occupancy_status = OccupancyStatus.VACANT


async def order_state(db: AsyncSession, session_id: int) -> OrderState:
    """Where a session's orders stand. Voided and abandoned orders never owe money."""
    orders = list(
        await db.scalars(select(Transaction).where(Transaction.session_id == session_id))
    )
    live = [order.txn_id for order in orders if order.status not in DROPPED]
    statuses: dict[int, list[PaymentStatus]] = defaultdict(list)
    if live:
        for txn_id, status in await db.execute(
            select(Payment.txn_id, Payment.status).where(Payment.txn_id.in_(live))
        ):
            statuses[txn_id].append(status)
    paid = [
        txn_id
        for txn_id in live
        if statuses[txn_id] and all(status is PaymentStatus.PAID for status in statuses[txn_id])
    ]
    return OrderState(
        placed=bool(orders),
        unpaid=len(paid) < len(live),
        paid=bool(paid),
        last_placed=max((order.placed_at for order in orders), default=None),
    )


async def _stale(db: AsyncSession, session: Session, now: datetime) -> bool:
    """Past its maximum age, idle with no order placed, or long settled with nothing owed."""
    if now - session.started_at > timedelta(hours=settings.SESSION_MAX_AGE_HOURS):
        return True

    state = await order_state(db, session.session_id)
    if state.unpaid:
        return False
    if state.placed:
        return now - state.last_placed > timedelta(minutes=settings.SESSION_SETTLED_MINUTES)

    last_joined = await db.scalar(
        select(func.max(SessionDevice.joined_at)).where(
            SessionDevice.session_id == session.session_id
        )
    )
    idle_since = last_joined or session.started_at
    return now - idle_since > timedelta(minutes=settings.SESSION_IDLE_MINUTES)


async def expire_stale_sessions(db: AsyncSession) -> list[Session]:
    """End every session its diners have walked away from, and free their tables."""
    now = datetime.now(UTC)
    active = list(
        await db.scalars(
            select(Session).where(Session.ended_at.is_(None)).order_by(Session.session_id)
        )
    )
    candidates = [session for session in active if await _stale(db, session, now)]
    if not candidates:
        return []

    await db.execute(
        select(Table.table_id)
        .where(Table.table_id.in_({session.table_id for session in candidates}))
        .order_by(Table.table_id)
        .with_for_update()
    )
    expired: list[Session] = []
    for session in candidates:
        await db.refresh(session)
        if session.ended_at is None and await _stale(db, session, now):
            await end_session(db, session, SessionEndReason.TIMEOUT, now)
            expired.append(session)

    # Commit
    await db.commit()
    return expired


async def close_if_settled(db: AsyncSession, session_id: int) -> Session | None:
    """End a session once every order on it is paid and nobody at the table is mid-cart."""
    session = await db.get(Session, session_id)
    if session is None:
        return None

    await db.execute(
        select(Table.table_id).where(Table.table_id == session.table_id).with_for_update()
    )
    await db.refresh(session)
    if session.ended_at is not None or _TABLE_CARTS.get(session_id):
        return None

    state = await order_state(db, session_id)
    if state.unpaid or not state.paid:
        return None

    await end_session(db, session, SessionEndReason.COMPLETED)

    # Commit
    await db.commit()
    return session


def diners_present(session: Session, now: datetime) -> bool:
    """Diners keep their table for a while after paying, so they can still call the crew."""
    if session.ended_at is None:
        return True
    return (
        session.end_reason is SessionEndReason.COMPLETED
        and now - session.ended_at <= timedelta(minutes=settings.SESSION_SETTLED_MINUTES)
    )


async def authorize_device(db: AsyncSession, session_id: int, device_token: UUID) -> SessionDevice:
    """Verify this device owns this session, separately from any role check."""
    device = await db.scalar(
        select(SessionDevice).where(
            SessionDevice.session_id == session_id,
            SessionDevice.device_token == device_token,
            SessionDevice.managed_by_device_id.is_(None),
        )
    )
    if device is None:
        raise PermissionError("This device is not part of that table session.")
    return device


async def get_session(db: AsyncSession, session_id: int) -> Session:
    session = await db.get(Session, session_id)
    if session is None:
        raise NotFoundError("That table session has ended. Scan the QR code again.")
    return session


# Update
async def update_device_profile(
    db: AsyncSession,
    session_id: int,
    device: SessionDevice,
    display_name: str | None,
) -> SessionDevice:
    """Update a participating device's display nickname within the table session."""
    await get_session(db, session_id)
    device.display_name = display_name.strip() if display_name else None
    await db.commit()
    await db.refresh(device)
    return device


# Delete
async def remove_session_device(
    db: AsyncSession,
    session_id: int,
    actor: SessionDevice,
    target_device_id: int,
) -> Session:
    """Allow the table host to remove a guest device and revoke its device_token per Security.md §5.8."""
    session = await get_session(db, session_id)
    if not actor.is_host:
        raise PermissionError("Only the host phone that opened the table session can remove devices.")

    if target_device_id == actor.device_id:
        raise BusinessRuleError("The host phone cannot remove itself from the session.")

    target = await db.scalar(
        select(SessionDevice).where(
            SessionDevice.session_id == session_id,
            SessionDevice.device_id == target_device_id,
        )
    )
    if target is None:
        raise NotFoundError("That device is no longer part of this table session.")
    if target.managed_by_device_id is not None:
        raise BusinessRuleError("Remove that person from the phone that added them.")

    leaving = {target_device_id} | await companion_ids(db, session_id, target_device_id)
    await _ensure_removable(db, leaving)
    await _drop_declarations(db, leaving)
    for device_id in leaving:
        clear_device_cart(session_id, device_id)
    await db.execute(delete(SessionDevice).where(SessionDevice.managed_by_device_id == target_device_id))
    await db.delete(target)
    await db.flush()

    remaining = await device_count(db, session_id)
    session.group_mode = remaining > 1
    session.declared_priority_status = await _latest_declared_status(db, session_id)
    session.session_type = resolve_session_type(
        session.declared_priority_status, session.group_mode
    )

    await db.commit()
    await db.refresh(session)
    return session


async def declare_priority(
    db: AsyncSession, session_id: int, device: SessionDevice, declared: PriorityStatus
) -> Session:
    """Record one phone's self-declared priority status. Only an explicit customer tap reaches here.

    The declaration belongs to the phone that made it, so in a group only that phone's
    lines carry the statutory discount. The discount stays provisional until the cashier
    checks the ID.
    """
    session = await get_session(db, session_id)
    if session.ended_at is not None:
        raise BusinessRuleError("That table session has ended. Scan the QR code again.")

    existing = await device_declaration(db, session_id, device.device_id)
    if existing is not None and existing.verified_at is not None:
        raise BusinessRuleError(
            "Your ID was already checked at the counter. Ask a staff member to change it."
        )

    if declared is PriorityStatus.STANDARD:
        if existing is not None:
            await db.delete(existing)
    else:
        eligible = declared in DISCOUNTABLE
        if existing is None:
            db.add(
                PriorityVerificationLog(
                    session_id=session_id,
                    device_id=device.device_id,
                    declared_status=declared,
                    id_presented=False,
                    discount_eligible=eligible,
                )
            )
        else:
            existing.declared_status = declared
            existing.discount_eligible = eligible

    await db.flush()

    if declared is PriorityStatus.STANDARD:
        session_status = await _latest_declared_status(db, session_id)
    else:
        session_status = declared

    session.declared_priority_status = session_status
    session.session_type = resolve_session_type(session_status, session.group_mode)

    if device.display_chosen_at is None:
        preset = DECLARED_DISPLAY if declared in DISCOUNTABLE else DEFAULT_DISPLAY
        apply_display(db, session, device, preset, "declaration")

    await db.commit()
    await db.refresh(session)
    await db.refresh(device)
    return session


def display_is_default(device: SessionDevice) -> bool:
    return all(getattr(device, setting) == value for setting, value in DEFAULT_DISPLAY.items())


def apply_display(
    db: AsyncSession,
    session: Session,
    device: SessionDevice,
    changes: dict[str, MenuSize | bool],
    source: str,
    screen_id: str | None = None,
) -> bool:
    """Change one phone's display settings, logging each real change for the dashboard."""
    changed = False
    for setting, value in changes.items():
        if getattr(device, setting) == value:
            continue
        setattr(device, setting, value)
        changed = True
        db.add(
            AnalyticsEvent(
                session_id=session.session_id,
                event_type=EventType.DISPLAY_CHANGED,
                screen_id=screen_id,
                metadata_={
                    "setting": setting,
                    "value": value.value if isinstance(value, MenuSize) else value,
                    "source": source,
                },
            )
        )
    if not display_is_default(device):
        session.ui_mode_used = UiMode.ACCESSIBLE
        if source in ("offer", "declaration"):
            session.accessibility_accepted = True
    return changed


async def set_preferences(
    db: AsyncSession,
    session_id: int,
    device: SessionDevice,
    language: Language | None,
    changes: dict[str, MenuSize | bool],
    source: str,
    screen_id: str | None = None,
) -> Session:
    session = await get_session(db, session_id)
    if language is not None:
        session.language_used = language
    if changes:
        apply_display(db, session, device, changes, source, screen_id)
        device.display_chosen_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(session)
    await db.refresh(device)
    return session


async def _latest_declared_status(db: AsyncSession, session_id: int) -> PriorityStatus:
    latest = await db.scalar(
        select(PriorityVerificationLog.declared_status)
        .where(PriorityVerificationLog.session_id == session_id)
        .order_by(PriorityVerificationLog.log_id.desc())
        .limit(1)
    )
    return latest or PriorityStatus.STANDARD


async def _ensure_removable(
    db: AsyncSession, device_ids: set[int], who: str = "That phone"
) -> None:
    """A phone with items on an order or a payment share is part of the record and stays."""
    on_record = await db.scalar(
        select(func.count()).select_from(TransactionItem).where(
            TransactionItem.device_id.in_(device_ids)
        )
    ) or await db.scalar(
        select(func.count()).select_from(Payment).where(Payment.device_id.in_(device_ids))
    )
    if on_record:
        raise BusinessRuleError(
            f"{who} already has items on an order at this table, so they can't be removed."
        )


async def _drop_declarations(db: AsyncSession, device_ids: set[int]) -> None:
    logs = list(
        await db.scalars(
            select(PriorityVerificationLog).where(
                PriorityVerificationLog.device_id.in_(device_ids)
            )
        )
    )
    if any(log.verified_at is not None for log in logs):
        raise BusinessRuleError(
            "That phone's ID was already checked at the counter, so it stays on this table."
        )
    for log in logs:
        await db.delete(log)
    await db.flush()


async def device_declaration(
    db: AsyncSession, session_id: int, device_id: int
) -> PriorityVerificationLog | None:
    return await db.scalar(
        select(PriorityVerificationLog).where(
            PriorityVerificationLog.session_id == session_id,
            PriorityVerificationLog.device_id == device_id,
        )
    )


async def declarations_for(
    db: AsyncSession, session_id: int, device_ids: set[int | None]
) -> list[PriorityVerificationLog]:
    """The declarations behind a set of priced lines, for showing their discount state."""
    wanted = {device_id for device_id in device_ids if device_id is not None}
    if not wanted:
        return []
    return list(
        await db.scalars(
            select(PriorityVerificationLog).where(
                PriorityVerificationLog.session_id == session_id,
                PriorityVerificationLog.device_id.in_(wanted),
            )
        )
    )


async def discount_devices(db: AsyncSession, session_id: int) -> set[int]:
    """Phones whose lines carry the statutory discount, per Algorithms.md §4.5.

    A row stays eligible while its ID check is pending and after the cashier verifies
    it; a rejected check clears the flag.
    """
    return set(
        await db.scalars(
            select(PriorityVerificationLog.device_id).where(
                PriorityVerificationLog.session_id == session_id,
                PriorityVerificationLog.discount_eligible.is_(True),
            )
        )
    )


async def pending_discount_devices(db: AsyncSession, session_id: int) -> set[int]:
    """Phones claiming a discount whose ID the cashier has not checked yet."""
    return set(
        await db.scalars(
            select(PriorityVerificationLog.device_id).where(
                PriorityVerificationLog.session_id == session_id,
                PriorityVerificationLog.discount_eligible.is_(True),
                PriorityVerificationLog.verified_at.is_(None),
            )
        )
    )


def discount_status(logs: list[PriorityVerificationLog]) -> str:
    """Collapse ID checks into one customer-facing state: pending wins, then verified."""
    claims = [log for log in logs if log.declared_status in DISCOUNTABLE]
    if any(log.discount_eligible and log.verified_at is None for log in claims):
        return "pending"
    if any(log.discount_eligible for log in claims):
        return "verified"
    if claims:
        return "rejected"
    return "none"


async def device_count(db: AsyncSession, session_id: int) -> int:
    """Phones at the table. People added without a phone are not counted."""
    return await db.scalar(
        select(func.count()).select_from(SessionDevice).where(
            SessionDevice.session_id == session_id,
            SessionDevice.managed_by_device_id.is_(None),
        )
    )


def seat_order(devices: list[SessionDevice]) -> list[SessionDevice]:
    """Phones in the order they joined, each followed by the people it added."""
    ordered: list[SessionDevice] = []
    for phone in (device for device in devices if device.managed_by_device_id is None):
        ordered.append(phone)
        ordered.extend(
            device for device in devices if device.managed_by_device_id == phone.device_id
        )
    return ordered


@dataclass(frozen=True)
class DeviceLabel:
    device_number: int | None
    is_host: bool
    display_name: str | None
    managed_by_device_id: int | None = None
    managed_by_number: int | None = None
    managed_by_name: str | None = None


async def device_labels(db: AsyncSession, session_ids: set[int]) -> dict[int, DeviceLabel]:
    """How each phone, and each person added from a phone, is named on shares and staff screens.

    Phones are numbered in the order they joined. A person without a phone has no number
    and is labelled by the phone that added them.
    """
    if not session_ids:
        return {}
    devices = list(
        await db.scalars(
            select(SessionDevice)
            .where(SessionDevice.session_id.in_(session_ids))
            .order_by(
                SessionDevice.session_id, SessionDevice.joined_at, SessionDevice.device_id
            )
        )
    )
    numbers: dict[int, int] = {}
    counters: dict[int, int] = defaultdict(int)
    for device in devices:
        if device.managed_by_device_id is None:
            counters[device.session_id] += 1
            numbers[device.device_id] = counters[device.session_id]
    names = {device.device_id: device.display_name for device in devices}
    return {
        device.device_id: (
            DeviceLabel(numbers[device.device_id], device.is_host, device.display_name)
            if device.managed_by_device_id is None
            else DeviceLabel(
                None,
                False,
                device.display_name,
                device.managed_by_device_id,
                numbers.get(device.managed_by_device_id),
                names.get(device.managed_by_device_id),
            )
        )
        for device in devices
    }


async def companion_ids(db: AsyncSession, session_id: int, manager_id: int) -> set[int]:
    """People without a phone that this phone added to the table."""
    return set(
        await db.scalars(
            select(SessionDevice.device_id).where(
                SessionDevice.session_id == session_id,
                SessionDevice.managed_by_device_id == manager_id,
            )
        )
    )


async def write_payer_carts(
    db: AsyncSession,
    session_id: int,
    device: SessionDevice,
    lines: list[tuple[str, int, int | None]],
) -> set[int]:
    """Replace the carts of the caller and of everyone it added without a phone.

    Each line names who it is for. A phone may order for itself and for the people it
    added, never for another phone. Returns the phone and its people.
    """
    payers = {device.device_id} | await companion_ids(db, session_id, device.device_id)
    grouped: dict[int, list[tuple[str, int]]] = {payer: [] for payer in payers}
    for item_id, quantity, target in lines:
        owner = target or device.device_id
        if owner not in grouped:
            raise PermissionError(
                "You can only order for yourself or for people you added from this phone."
            )
        grouped[owner].append((item_id, quantity))
    for owner, owner_lines in grouped.items():
        update_device_cart(session_id, owner, owner_lines)
    return payers


def get_group_cart_lines(session_id: int, device_ids: set[int]) -> list[tuple[str, int, int]]:
    carts = _TABLE_CARTS.get(session_id, {})
    return [
        (item_id, quantity, device_id)
        for device_id in sorted(device_ids)
        for item_id, quantity in carts.get(device_id, [])
    ]


async def managed_companions(
    db: AsyncSession, session_id: int, manager_id: int
) -> list[tuple[SessionDevice, PriorityVerificationLog | None, bool]]:
    """The people this phone added, each with their declaration and whether they ordered."""
    companions = list(
        await db.scalars(
            select(SessionDevice)
            .where(
                SessionDevice.session_id == session_id,
                SessionDevice.managed_by_device_id == manager_id,
            )
            .order_by(SessionDevice.joined_at, SessionDevice.device_id)
        )
    )
    if not companions:
        return []
    ids = {companion.device_id for companion in companions}
    logs = {
        log.device_id: log
        for log in await db.scalars(
            select(PriorityVerificationLog).where(PriorityVerificationLog.device_id.in_(ids))
        )
    }
    ordered = set(
        await db.scalars(
            select(TransactionItem.device_id).where(TransactionItem.device_id.in_(ids)).distinct()
        )
    )
    return [
        (companion, logs.get(companion.device_id), companion.device_id in ordered)
        for companion in companions
    ]


async def add_companion(
    db: AsyncSession,
    session_id: int,
    manager: SessionDevice,
    display_name: str,
    declared: PriorityStatus,
) -> Session:
    """Add a senior or PWD diner who has no phone. Their items carry their own discount."""
    session = await get_session(db, session_id)
    if session.ended_at is not None:
        raise BusinessRuleError("That table session has ended. Scan the QR code again.")
    if declared not in DISCOUNTABLE:
        raise BusinessRuleError("Only a senior citizen or a person with disability can be added.")

    await db.execute(
        select(SessionDevice.device_id)
        .where(SessionDevice.device_id == manager.device_id)
        .with_for_update()
    )
    if len(await companion_ids(db, session_id, manager.device_id)) >= MAX_COMPANIONS_PER_PHONE:
        raise BusinessRuleError(
            f"One phone can add up to {MAX_COMPANIONS_PER_PHONE} people without a phone."
        )

    companion = SessionDevice(
        session_id=session_id,
        managed_by_device_id=manager.device_id,
        is_host=False,
        display_name=display_name.strip(),
    )
    db.add(companion)
    await db.flush()
    db.add(
        PriorityVerificationLog(
            session_id=session_id,
            device_id=companion.device_id,
            declared_status=declared,
            id_presented=False,
            discount_eligible=True,
        )
    )
    session.declared_priority_status = declared
    session.session_type = resolve_session_type(declared, session.group_mode)
    await db.commit()
    await db.refresh(session)
    return session


async def remove_companion(
    db: AsyncSession, session_id: int, manager: SessionDevice, companion_id: int
) -> Session:
    session = await get_session(db, session_id)
    companion = await db.scalar(
        select(SessionDevice).where(
            SessionDevice.session_id == session_id,
            SessionDevice.device_id == companion_id,
            SessionDevice.managed_by_device_id.is_not(None),
        )
    )
    if companion is None:
        raise NotFoundError("That person is no longer at this table.")
    if companion.managed_by_device_id != manager.device_id:
        raise PermissionError("Only the phone that added that person can remove them.")

    await _ensure_removable(db, {companion_id}, who="That person")
    await _drop_declarations(db, {companion_id})
    clear_device_cart(session_id, companion_id)
    await db.delete(companion)
    await db.flush()

    session.declared_priority_status = await _latest_declared_status(db, session_id)
    session.session_type = resolve_session_type(
        session.declared_priority_status, session.group_mode
    )
    await db.commit()
    await db.refresh(session)
    return session


# Update
def update_device_cart(
    session_id: int, device_id: int, lines: list[tuple[str, int]]
) -> None:
    if lines:
        _TABLE_CARTS[session_id][device_id] = lines
    else:
        _TABLE_CARTS[session_id].pop(device_id, None)


def get_device_cart_lines(session_id: int, device_id: int) -> list[tuple[str, int]]:
    return list(_TABLE_CARTS.get(session_id, {}).get(device_id, []))


def clear_device_cart(session_id: int, device_id: int) -> None:
    if session_id in _TABLE_CARTS:
        _TABLE_CARTS[session_id].pop(device_id, None)


def clear_table_cart(session_id: int) -> None:
    _TABLE_CARTS.pop(session_id, None)


def get_all_session_cart_lines(session_id: int) -> list[tuple[str, int, int]]:
    session_carts = _TABLE_CARTS.get(session_id, {})
    combined: list[tuple[str, int, int]] = []
    for dev_id, dev_lines in session_carts.items():
        for item_id, qty in dev_lines:
            combined.append((item_id, qty, dev_id))
    return combined


# Read
async def get_table_cart(
    db: AsyncSession,
    session_id: int,
    current_device_id: int,
    language: str = "en",
) -> TableCartRead:
    ordering_session = await get_session(db, session_id)
    devices = seat_order(
        list(
            await db.scalars(
                select(SessionDevice)
                .where(SessionDevice.session_id == session_id)
                .order_by(SessionDevice.joined_at.asc(), SessionDevice.device_id.asc())
            )
        )
    )
    phone_count = sum(1 for dev in devices if dev.managed_by_device_id is None)
    labels = await device_labels(db, {session_id})
    companion_status = {
        log.device_id: log.declared_status
        for log in await declarations_for(
            db,
            session_id,
            {dev.device_id for dev in devices if dev.managed_by_device_id is not None},
        )
    }

    def share(dev: SessionDevice, **fields) -> DeviceShareRead:
        return DeviceShareRead(
            device_id=dev.device_id,
            device_number=labels[dev.device_id].device_number,
            display_name=dev.display_name,
            is_host=dev.is_host,
            is_me=dev.device_id == current_device_id,
            is_companion=dev.managed_by_device_id is not None,
            managed_by_device_id=dev.managed_by_device_id,
            managed_by_number=labels[dev.device_id].managed_by_number,
            managed_by_me=dev.managed_by_device_id == current_device_id,
            declared_status=companion_status.get(dev.device_id),
            **fields,
        )

    def item_name(item: MenuItem) -> str:
        return {
            "en": item.name_en,
            "fil": item.name_fil,
            "bis": item.name_bis,
        }.get(language, item.name_en)

    session_carts = _TABLE_CARTS.get(session_id, {})
    live_item_ids = {
        item_id
        for dev_lines in session_carts.values()
        for item_id, _ in dev_lines
    }
    items_by_id: dict[str, MenuItem] = {}
    if live_item_ids:
        items_by_id = {
            item.item_id: item
            for item in await db.scalars(
                select(MenuItem).where(MenuItem.item_id.in_(live_item_ids))
            )
        }

    active_open_txn: Transaction | None = None
    active_payments: list[Payment] = []

    if ordering_session.group_mode:
        txns = list(
            await db.scalars(
                select(Transaction)
                .where(
                    Transaction.session_id == session_id,
                    Transaction.status == TxnStatus.PENDING,
                )
                .order_by(Transaction.placed_at.desc())
            )
        )
        for txn in txns:
            payments = list(
                await db.scalars(select(Payment).where(Payment.txn_id == txn.txn_id))
            )
            has_unsettled_split = len(payments) > 1 and any(
                p.status != PaymentStatus.PAID for p in payments
            )
            has_awaiting_choice = any(
                p.aggregator_ref == "AWAITING-CHOICE" and p.status != PaymentStatus.PAID
                for p in payments
            )
            if has_unsettled_split or has_awaiting_choice:
                active_open_txn = txn
                active_payments = payments
                break

    if active_open_txn is not None:
        rows = await db.execute(
            select(TransactionItem, MenuItem)
            .join(MenuItem, MenuItem.item_id == TransactionItem.item_id)
            .where(TransactionItem.txn_id == active_open_txn.txn_id)
            .order_by(TransactionItem.txi_id)
        )
        tx_items = rows.all()
        pay_by_dev = {p.device_id: p for p in active_payments if p.device_id is not None}

        shares: list[DeviceShareRead] = []
        table_total = Decimal("0.00")
        my_share_total = Decimal("0.00")
        unpaid_total = Decimal("0.00")

        for dev in devices:
            dev_pay = pay_by_dev.get(dev.device_id)
            share_lines: list[DeviceCartLineRead] = []
            for line, menu_item in tx_items:
                if line.device_id == dev.device_id:
                    share_lines.append(
                        DeviceCartLineRead(
                            item_id=menu_item.item_id,
                            name=item_name(menu_item),
                            quantity=line.quantity,
                            unit_price=line.unit_price,
                            subtotal=line.subtotal,
                        )
                    )

            raw_live_lines = session_carts.get(dev.device_id, [])
            if raw_live_lines and (dev_pay is None or dev_pay.status != PaymentStatus.PAID):
                if not share_lines:
                    for item_id, qty in raw_live_lines:
                        menu_item = items_by_id.get(item_id)
                        if menu_item is None:
                            continue
                        line_sub = _money(menu_item.price * qty)
                        share_lines.append(
                            DeviceCartLineRead(
                                item_id=menu_item.item_id,
                                name=item_name(menu_item),
                                quantity=qty,
                                unit_price=menu_item.price,
                                subtotal=line_sub,
                            )
                        )

            if dev_pay is not None:
                share_sub = dev_pay.amount
                pay_status = dev_pay.status
            else:
                share_sub = sum((l.subtotal for l in share_lines), Decimal("0.00"))
                pay_status = PaymentStatus.PENDING if share_sub > Decimal("0.00") else None

            is_me = dev.device_id == current_device_id
            table_total += share_sub
            if pay_status != PaymentStatus.PAID:
                unpaid_total += share_sub
            if is_me and pay_status != PaymentStatus.PAID:
                my_share_total = share_sub

            shares.append(share(dev, subtotal=share_sub, payment_status=pay_status, lines=share_lines))

        return TableCartRead(
            session_id=session_id,
            device_count=phone_count,
            table_total=table_total,
            my_share_total=my_share_total,
            unpaid_total=unpaid_total,
            active_txn_id=active_open_txn.txn_id,
            shares=shares,
        )

    shares = []
    table_total = Decimal("0.00")
    my_share_total = Decimal("0.00")

    for dev in devices:
        raw_lines = session_carts.get(dev.device_id, [])
        share_lines = []
        share_subtotal = Decimal("0.00")

        for item_id, qty in raw_lines:
            menu_item = items_by_id.get(item_id)
            if menu_item is None:
                continue
            line_sub = _money(menu_item.price * qty)
            share_subtotal += line_sub
            share_lines.append(
                DeviceCartLineRead(
                    item_id=menu_item.item_id,
                    name=item_name(menu_item),
                    quantity=qty,
                    unit_price=menu_item.price,
                    subtotal=line_sub,
                )
            )

        is_me = dev.device_id == current_device_id
        table_total += share_subtotal
        if is_me:
            my_share_total = share_subtotal

        shares.append(share(dev, subtotal=share_subtotal, payment_status=None, lines=share_lines))

    return TableCartRead(
        session_id=session_id,
        device_count=phone_count,
        table_total=table_total,
        my_share_total=my_share_total,
        unpaid_total=table_total,
        active_txn_id=None,
        shares=shares,
    )
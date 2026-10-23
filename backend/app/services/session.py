from collections import defaultdict
from datetime import UTC, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import BusinessRuleError, NotFoundError, PermissionError
from app.models import (
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
    PaymentStatus,
    PriorityStatus,
    SessionType,
    TxnStatus,
    UiMode,
)
from app.schemas.session import DeviceCartLineRead, DeviceShareRead, TableCartRead

DISCOUNTABLE = (PriorityStatus.SENIOR, PriorityStatus.PWD)
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


async def open_session(
    db: AsyncSession, qr_token: UUID, device_token: UUID | None
) -> tuple[Session, SessionDevice, Table]:
    """Open or rejoin a table session from a scanned QR token."""
    # Read
    table = await db.scalar(
        select(Table)
        .where(Table.qr_token == qr_token)
        .with_for_update()
    )
    if table is None or not table.is_active:
        raise NotFoundError("That QR code is not recognised. Ask staff for help.")

    active = await db.scalar(
        select(Session)
        .where(Session.table_id == table.table_id, Session.ended_at.is_(None))
        .order_by(Session.started_at.desc())
    )

    if active is not None and _expired(active):
        active.ended_at = datetime.now(UTC)
        table.occupancy_status = OccupancyStatus.VACANT
        _TABLE_CARTS.pop(active.session_id, None)
        await db.flush()
        active = None

    if active is None:
        session = Session(table_id=table.table_id)
        db.add(session)
        await db.flush()

        device = SessionDevice(session_id=session.session_id, is_host=True)
        db.add(device)
        table.occupancy_status = OccupancyStatus.OCCUPIED
        await db.commit()
        await db.refresh(session)
        await db.refresh(device)
        return session, device, table

    # Read
    if device_token is not None:
        known = await db.scalar(
            select(SessionDevice).where(
                SessionDevice.session_id == active.session_id,
                SessionDevice.device_token == device_token,
            )
        )
        if known is not None:
            await db.commit()
            return active, known, table

    # Create
    device = SessionDevice(session_id=active.session_id, is_host=False)
    db.add(device)
    active.group_mode = True
    active.session_type = resolve_session_type(active.declared_priority_status, True)
    await db.commit()
    await db.refresh(active)
    await db.refresh(device)
    return active, device, table


def _expired(session: Session) -> bool:
    age = datetime.now(UTC) - session.started_at
    return age > timedelta(hours=settings.SESSION_MAX_AGE_HOURS)


async def authorize_device(db: AsyncSession, session_id: int, device_token: UUID) -> SessionDevice:
    """Verify this device owns this session, separately from any role check."""
    device = await db.scalar(
        select(SessionDevice).where(
            SessionDevice.session_id == session_id,
            SessionDevice.device_token == device_token,
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


async def declare_priority(
    db: AsyncSession, session_id: int, declared: PriorityStatus
) -> Session:
    """Record a self-declared priority status and its verification-log entry."""
    session = await get_session(db, session_id)
    if session.ended_at is not None:
        raise BusinessRuleError("That table session has ended. Scan the QR code again.")

    session.declared_priority_status = declared
    session.session_type = resolve_session_type(declared, session.group_mode)
    session.accessibility_accepted = declared is not PriorityStatus.STANDARD
    session.ui_mode_used = (
        UiMode.ACCESSIBLE if declared is not PriorityStatus.STANDARD else UiMode.STANDARD
    )

    existing = await db.scalar(
        select(PriorityVerificationLog).where(
            PriorityVerificationLog.session_id == session_id
        )
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
                    declared_status=declared,
                    id_presented=False,
                    discount_eligible=eligible,
                )
            )
        else:
            existing.declared_status = declared
            existing.discount_eligible = eligible

    await db.commit()
    await db.refresh(session)
    return session


async def set_preferences(
    db: AsyncSession,
    session_id: int,
    language: Language | None,
    ui_mode: UiMode | None,
) -> Session:
    session = await get_session(db, session_id)
    if language is not None:
        session.language_used = language
    if ui_mode is not None:
        session.ui_mode_used = ui_mode
    await db.commit()
    await db.refresh(session)
    return session


async def discount_eligible(db: AsyncSession, session_id: int) -> bool:
    """A discount needs a verification row flagged eligible, per Algorithms.md §4.5."""
    return bool(
        await db.scalar(
            select(PriorityVerificationLog.log_id).where(
                PriorityVerificationLog.session_id == session_id,
                PriorityVerificationLog.discount_eligible.is_(True),
            )
        )
    )


async def device_count(db: AsyncSession, session_id: int) -> int:
    return await db.scalar(
        select(func.count()).select_from(SessionDevice).where(
            SessionDevice.session_id == session_id
        )
    )


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
    devices = list(
        await db.scalars(
            select(SessionDevice)
            .where(SessionDevice.session_id == session_id)
            .order_by(SessionDevice.joined_at.asc(), SessionDevice.device_id.asc())
        )
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

        for index, dev in enumerate(devices, start=1):
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

            shares.append(
                DeviceShareRead(
                    device_id=dev.device_id,
                    device_number=index,
                    is_host=dev.is_host,
                    is_me=is_me,
                    subtotal=share_sub,
                    payment_status=pay_status,
                    lines=share_lines,
                )
            )

        return TableCartRead(
            session_id=session_id,
            device_count=len(devices),
            table_total=table_total,
            my_share_total=my_share_total,
            unpaid_total=unpaid_total,
            active_txn_id=active_open_txn.txn_id,
            shares=shares,
        )

    shares = []
    table_total = Decimal("0.00")
    my_share_total = Decimal("0.00")

    for index, dev in enumerate(devices, start=1):
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

        shares.append(
            DeviceShareRead(
                device_id=dev.device_id,
                device_number=index,
                is_host=dev.is_host,
                is_me=is_me,
                subtotal=share_subtotal,
                payment_status=None,
                lines=share_lines,
            )
        )

    return TableCartRead(
        session_id=session_id,
        device_count=len(devices),
        table_total=table_total,
        my_share_total=my_share_total,
        unpaid_total=table_total,
        active_txn_id=None,
        shares=shares,
    )
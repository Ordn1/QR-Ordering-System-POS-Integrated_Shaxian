from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models import (
    AnalyticsEvent,
    AuditLog,
    MenuItem,
    PriorityVerificationLog,
    Session,
    StaffAccount,
    Transaction,
    TransactionItem,
)
from app.models.enums import EventType, PriorityStatus, TxnStatus

TRIGGER_EVENT = EventType.RECOMMENDATION_SHOWN


def mask_name(name: str | None) -> str | None:
    """Mask cardholder name per Security.md §5.4 (first letter of each part + bullets)."""
    if not name:
        return None
    parts = [part for part in name.strip().split() if part]
    if not parts:
        return None
    return " ".join(f"{part[0]}•••" for part in parts)


async def record(
    db: AsyncSession,
    session_id: int,
    event_type: EventType,
    screen_id: str | None,
    metadata: dict[str, Any] | None,
) -> AnalyticsEvent:
    event = AnalyticsEvent(
        session_id=session_id,
        event_type=event_type,
        screen_id=screen_id,
        metadata_=metadata,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event


async def trigger_history(db: AsyncSession, session_id: int) -> tuple[int, str | None]:
    """Recover the session's trigger count and last trigger time across a page refresh."""
    row = await db.execute(
        select(func.count(), func.max(AnalyticsEvent.occurred_at)).where(
            AnalyticsEvent.session_id == session_id,
            AnalyticsEvent.event_type == TRIGGER_EVENT,
        )
    )
    count, last = row.one()
    return count, last.isoformat() if last is not None else None


async def sales_by_day(db: AsyncSession, days: int = 14) -> list[dict[str, Any]]:
    """Net sales and order count per business day, oldest first."""
    rows = await db.execute(
        select(
            Transaction.queue_date,
            func.count().label("orders"),
            func.coalesce(func.sum(Transaction.net_amount), 0).label("net"),
        )
        .where(Transaction.status != TxnStatus.VOIDED)
        .group_by(Transaction.queue_date)
        .order_by(Transaction.queue_date.desc())
        .limit(days)
    )
    return [
        {"date": day.isoformat(), "orders": orders, "net": float(net)}
        for day, orders, net in reversed(rows.all())
    ]


async def top_items(db: AsyncSession, limit: int = 8) -> list[dict[str, Any]]:
    rows = await db.execute(
        select(
            MenuItem.name_en,
            func.sum(TransactionItem.quantity).label("units"),
            func.sum(TransactionItem.subtotal).label("revenue"),
        )
        .join(MenuItem, MenuItem.item_id == TransactionItem.item_id)
        .join(Transaction, Transaction.txn_id == TransactionItem.txn_id)
        .where(Transaction.status != TxnStatus.VOIDED)
        .group_by(MenuItem.name_en)
        .order_by(func.sum(TransactionItem.quantity).desc())
        .limit(limit)
    )
    return [
        {"name": name, "units": int(units), "revenue": float(revenue)}
        for name, units, revenue in rows.all()
    ]


async def segment_mix(db: AsyncSession) -> list[dict[str, Any]]:
    rows = await db.execute(
        select(Session.session_type, func.count(Transaction.txn_id))
        .join(Transaction, Transaction.session_id == Session.session_id)
        .where(Transaction.status != TxnStatus.VOIDED)
        .group_by(Session.session_type)
    )
    return [{"segment": segment.value, "orders": count} for segment, count in rows.all()]


async def priority_mix(db: AsyncSession) -> list[dict[str, Any]]:
    """Sessions by *declared* status."""
    rows = await db.execute(
        select(Session.declared_priority_status, func.count())
        .group_by(Session.declared_priority_status)
    )
    tally = {status.value: count for status, count in rows.all()}
    return [
        {"status": status.value, "sessions": tally.get(status.value, 0)}
        for status in PriorityStatus
    ]


# Read
async def verification_log(db: AsyncSession, limit: int = 100) -> list[dict[str, Any]]:
    """The priority-declaration audit trail, newest first, with server-side personal data masking."""
    rows = await db.execute(
        select(PriorityVerificationLog, Session.started_at, StaffAccount.full_name)
        .join(Session, Session.session_id == PriorityVerificationLog.session_id)
        .outerjoin(
            StaffAccount, StaffAccount.staff_id == PriorityVerificationLog.verified_by
        )
        .order_by(PriorityVerificationLog.log_id.desc())
        .limit(limit)
    )
    return [
        {
            "log_id": log.log_id,
            "session_id": log.session_id,
            "declared_status": log.declared_status.value,
            "id_presented": log.id_presented,
            "id_last4": log.id_last4,
            "cardholder_name": mask_name(log.cardholder_name),
            "issuing_lgu": log.issuing_lgu,
            "verified_by": verifier,
            "verified_at": log.verified_at.isoformat() if log.verified_at else None,
            "discount_eligible": log.discount_eligible,
            "declared_at": started_at.isoformat(),
        }
        for log, started_at, verifier in rows.all()
    ]


# Read
async def get_unmasked_verification(
    db: AsyncSession, log_id: int, staff_id: str
) -> dict[str, Any]:
    """Return unmasked verification details for one record and write an audit_log entry per Security.md §5.4."""
    row = await db.execute(
        select(PriorityVerificationLog, Session.started_at, StaffAccount.full_name)
        .join(Session, Session.session_id == PriorityVerificationLog.session_id)
        .outerjoin(
            StaffAccount, StaffAccount.staff_id == PriorityVerificationLog.verified_by
        )
        .where(PriorityVerificationLog.log_id == log_id)
    )
    found = row.first()
    if found is None:
        raise NotFoundError("That verification record no longer exists.")

    log, started_at, verifier = found
    db.add(
        AuditLog(
            staff_id=staff_id,
            action="verification_unmask",
            entity_type="priority_verification_log",
            entity_id=str(log.log_id),
            after_state={
                "session_id": log.session_id,
                "declared_status": log.declared_status.value,
            },
        )
    )
    await db.commit()

    return {
        "log_id": log.log_id,
        "session_id": log.session_id,
        "declared_status": log.declared_status.value,
        "id_presented": log.id_presented,
        "id_last4": log.id_last4,
        "cardholder_name": log.cardholder_name,
        "issuing_lgu": log.issuing_lgu,
        "verified_by": verifier,
        "verified_at": log.verified_at.isoformat() if log.verified_at else None,
        "discount_eligible": log.discount_eligible,
        "declared_at": started_at.isoformat(),
    }


async def recommendation_funnel(db: AsyncSession) -> dict[str, int]:
    rows = await db.execute(
        select(AnalyticsEvent.event_type, func.count())
        .where(
            AnalyticsEvent.event_type.in_(
                [
                    EventType.RECOMMENDATION_SHOWN,
                    EventType.RECOMMENDATION_ACCEPTED,
                    EventType.RECOMMENDATION_DISMISSED,
                ]
            )
        )
        .group_by(AnalyticsEvent.event_type)
    )
    tally = {event.value: count for event, count in rows.all()}
    return {
        "shown": tally.get("recommendation_shown", 0),
        "accepted": tally.get("recommendation_accepted", 0),
        "dismissed": tally.get("recommendation_dismissed", 0),
    }


async def headline(db: AsyncSession) -> dict[str, Any]:
    """Totals across all non-voided orders, plus the priority and trigger shares."""
    totals = (
        await db.execute(
            select(
                func.count(),
                func.coalesce(func.sum(Transaction.gross_amount), 0),
                func.coalesce(func.sum(Transaction.net_amount), 0),
                func.coalesce(func.sum(Transaction.vat_amount), 0),
                func.coalesce(func.sum(Transaction.discount_amount), 0),
                func.count().filter(Transaction.is_priority.is_(True)),
            ).where(Transaction.status != TxnStatus.VOIDED)
        )
    ).one()

    orders, gross, net, vat, discount, priority_orders = totals
    sessions = await db.scalar(select(func.count()).select_from(Session)) or 0
    declared = await db.scalar(
        select(func.count()).select_from(PriorityVerificationLog)
    ) or 0
    triggers = await db.scalar(
        select(func.count())
        .select_from(AnalyticsEvent)
        .where(AnalyticsEvent.event_type == EventType.RECOMMENDATION_SHOWN)
    ) or 0

    return {
        "orders": orders,
        "gross_amount": float(gross),
        "net_amount": float(net),
        "vat_amount": float(vat),
        "discount_amount": float(discount),
        "average_order": float(net) / orders if orders else 0.0,
        "priority_share": priority_orders / orders if orders else 0.0,
        "priority_declarations": declared,
        "sessions": sessions,
        "trigger_rate": triggers / sessions if sessions else 0.0,
    }
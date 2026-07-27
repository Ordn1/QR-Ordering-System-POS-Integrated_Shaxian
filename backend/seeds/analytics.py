import random
from datetime import timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AnalyticsEvent, Session, Transaction
from app.models.enums import EventType, SessionType

SEED = 20260727
SIGNALS = (
    EventType.DWELL_TIMEOUT,
    EventType.BACK_NAVIGATION,
    EventType.SCROLL_REVERSAL,
    EventType.CART_ABANDON,
)

TRIGGER_RATE = {SessionType.PRIORITY: 0.55, SessionType.GROUP: 0.42, SessionType.STANDARD: 0.30}
ACCEPT_RATE = {SessionType.PRIORITY: 0.62, SessionType.GROUP: 0.48, SessionType.STANDARD: 0.41}


async def seed_analytics(
    db: AsyncSession, sessions: list[Session], transactions: list[Transaction]
) -> int:
    """Give historical sessions the interaction trail the live client would have written."""
    rng = random.Random(SEED)
    placed_at = {txn.session_id: txn.placed_at for txn in transactions}
    events: list[AnalyticsEvent] = []

    for ordering_session in sessions:
        started = placed_at.get(ordering_session.session_id, ordering_session.started_at)
        browsing = started - timedelta(minutes=rng.randint(4, 11))
        triggers = TRIGGER_RATE[ordering_session.session_type]
        fires = rng.random() < triggers

        chosen = rng.sample(SIGNALS, 2 if fires else rng.randint(0, 1))
        for offset, signal in enumerate(chosen):
            events.append(
                AnalyticsEvent(
                    session_id=ordering_session.session_id,
                    event_type=signal,
                    screen_id="menu",
                    occurred_at=browsing + timedelta(seconds=25 * offset + rng.randint(5, 40)),
                    metadata_=(
                        {"dwell_seconds": rng.randint(45, 90)}
                        if signal is EventType.DWELL_TIMEOUT
                        else None
                    ),
                )
            )

        if not fires:
            continue

        shown_at = browsing + timedelta(seconds=90 + rng.randint(0, 45))
        events.append(
            AnalyticsEvent(
                session_id=ordering_session.session_id,
                event_type=EventType.RECOMMENDATION_SHOWN,
                screen_id="menu",
                occurred_at=shown_at,
                metadata_={"signals": [signal.value for signal in chosen]},
            )
        )
        accepted = rng.random() < ACCEPT_RATE[ordering_session.session_type]
        events.append(
            AnalyticsEvent(
                session_id=ordering_session.session_id,
                event_type=(
                    EventType.RECOMMENDATION_ACCEPTED
                    if accepted
                    else EventType.RECOMMENDATION_DISMISSED
                ),
                screen_id="menu",
                occurred_at=shown_at + timedelta(seconds=rng.randint(4, 25)),
            )
        )

    db.add_all(events)
    await db.flush()
    return len(events)

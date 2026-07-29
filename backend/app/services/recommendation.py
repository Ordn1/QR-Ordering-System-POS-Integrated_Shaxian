from sqlalchemy import literal, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AprioriRule, MenuItem
from app.models.enums import SessionType

TOP_N = 3
USEFUL_LIFT = 1.0


async def recommend(
    db: AsyncSession, segment: SessionType, cart: list[str], language: str
) -> list[dict]:
    """Return the top rules for this cart, scoped strictly to the session's segment."""
    rules = await matching_rules(db, segment, cart)
    if not rules and cart:
        rules = await matching_rules(db, segment, cart=[])

    suggested: list[str] = []
    for rule in rules:
        for item_id in rule.consequents:
            if item_id not in cart and item_id not in suggested:
                suggested.append(item_id)
        if len(suggested) >= TOP_N:
            break

    if not suggested:
        return []

    items = {
        item.item_id: item
        for item in await db.scalars(
            select(MenuItem).where(
                MenuItem.item_id.in_(suggested[:TOP_N]),
                MenuItem.is_available.is_(True),
            )
        )
    }

    # reversed() so the best rule wins the key, matching the lift-desc ordering
    metrics_by_item = {
        item_id: rule
        for rule in reversed(rules)
        for item_id in rule.consequents
    }

    return [
        {
            "item_id": item.item_id,
            "name": {"en": item.name_en, "fil": item.name_fil, "bis": item.name_bis}[language],
            "price": item.price,
            "image_filename": item.image_filename,
            "lift": metrics_by_item[item.item_id].lift,
            "confidence": metrics_by_item[item.item_id].confidence,
        }
        for item_id in suggested[:TOP_N]
        if (item := items.get(item_id)) is not None
    ]


async def matching_rules(
    db: AsyncSession, segment: SessionType, cart: list[str]
) -> list[AprioriRule]:
    """Rules whose antecedent is satisfied by the cart, best lift first.

    An empty cart has no antecedent to match, so it falls back to the segment's
    strongest consequents — the moment paralysis is most likely, per Algorithms.md §3.6.
    """
    statement = (
        select(AprioriRule)
        .where(AprioriRule.session_type == segment, AprioriRule.lift > USEFUL_LIFT)
        .order_by(AprioriRule.lift.desc())
    )

    if cart:
        statement = statement.where(
            AprioriRule.antecedents.op("<@")(literal(cart, JSONB))
        )

    return list(await db.scalars(statement.limit(20)))

from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AprioriRule, MenuItem
from app.models.enums import SessionType

RULES: tuple[tuple[SessionType, tuple[str, ...], tuple[str, ...], str, str, str], ...] = (
    (SessionType.PRIORITY, ("Wonton",), ("Steamed Rice",), "0.6700", "1.0000", "1.4900"),
    (SessionType.PRIORITY, ("Steamed Rice",), ("Chicken Soup",), "0.4200", "0.7100", "1.3800"),
    (SessionType.PRIORITY, ("Skinless Wonton",), ("Steamed Rice",), "0.3900", "0.8800", "1.3100"),
    (SessionType.PRIORITY, ("Wonton Noodle Soup",), ("Tea Eggs",), "0.2600", "0.6200", "1.2700"),
    (SessionType.PRIORITY, ("Steamed Rice",), ("Braised Pork",), "0.2100", "0.5400", "1.2200"),
    (SessionType.PRIORITY, ("Wonton",), ("Chicken Soup",), "0.1900", "0.4800", "1.1600"),
    (SessionType.STANDARD, ("Wonton",), ("Steamed Rice",), "0.5100", "0.7400", "1.1200"),
    (SessionType.STANDARD, ("Peanut Butter Noodles",), ("Wonton",), "0.4400", "0.8100", "1.6300"),
    (SessionType.STANDARD, ("Fried Noodles",), ("Tea Eggs",), "0.4700", "0.7900", "1.5500"),
    (SessionType.STANDARD, ("Peanut Butter Noodles",), ("Tea Eggs",), "0.3800", "0.6900", "1.4100"),
    (SessionType.STANDARD, ("Fried Bihon",), ("Steamed Rice",), "0.2900", "0.6100", "1.3400"),
    (SessionType.STANDARD, ("Xiaolongbao",), ("Wonton",), "0.2300", "0.5700", "1.2900"),
    (SessionType.STANDARD, ("Fried Wonton",), ("Peanut Butter Noodles",), "0.2000", "0.6600", "1.4700"),
    (SessionType.GROUP, ("Wonton",), ("Steamed Rice",), "0.3300", "0.5200", "1.0500"),
    (SessionType.GROUP, ("Braised Pork Feet",), ("Steamed Rice",), "0.5800", "0.9100", "1.7200"),
    (SessionType.GROUP, ("Braised Pork",), ("Steamed Rice",), "0.4900", "0.8300", "1.5900"),
    (SessionType.GROUP, ("Braised Pork Feet",), ("Braised Pork",), "0.3600", "0.7200", "1.6800"),
    (SessionType.GROUP, ("Braised Pork",), ("Xiaolongbao",), "0.3100", "0.6400", "1.4400"),
    (SessionType.GROUP, ("Pickled Chicken Feet",), ("Braised Pork",), "0.2700", "0.7000", "1.5100"),
    (SessionType.GROUP, ("Braised Pork Feet",), ("Fried Noodles",), "0.2400", "0.5900", "1.3600"),
)


async def seed_rules(session: AsyncSession, items: dict[str, MenuItem]) -> list[AprioriRule]:
    rules = [
        AprioriRule(
            session_type=session_type,
            antecedents=[items[name].item_id for name in antecedents],
            consequents=[items[name].item_id for name in consequents],
            support=Decimal(support),
            confidence=Decimal(confidence),
            lift=Decimal(lift),
        )
        for session_type, antecedents, consequents, support, confidence, lift in RULES
    ]
    session.add_all(rules)
    await session.flush()
    return rules

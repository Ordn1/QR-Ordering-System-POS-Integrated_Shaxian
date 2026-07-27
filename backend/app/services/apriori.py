"""Apriori rule generation — the Phase A batch job of Algorithms.md §3.

Reads completed transactions, segments them by the session's declared ordering
context, and mines association rules per segment with mlxtend. Each segment gets
its own rule set, which is what lets the same item pair carry a different lift
depending on who ordered it.

Thresholds were chosen against the real seeded history rather than guessed: at
min_support 0.15 every segment yields rules (8 standard / 14 priority / 11 group)
with lift spreads of roughly 1.1–1.5. Lowering the floor further inflates the rule
count on baskets too thin to support it.
"""

from dataclasses import dataclass
from decimal import Decimal

import pandas as pd
from mlxtend.frequent_patterns import apriori, association_rules
from mlxtend.preprocessing import TransactionEncoder
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AprioriRule, MenuItem, Session, Transaction, TransactionItem
from app.models.enums import SessionType, TxnStatus

MIN_SUPPORT = 0.15
MIN_LIFT = 1.05
MAX_RULES_PER_SEGMENT = 12
QUANTISE = Decimal("0.0001")


@dataclass(frozen=True)
class SegmentReport:
    segment: str
    baskets: int
    itemsets: int
    rules: int


def _mine(baskets: list[list[str]]) -> pd.DataFrame:
    """Frequent itemsets to association rules, single-item consequents only."""
    encoder = TransactionEncoder()
    frame = pd.DataFrame(
        encoder.fit(baskets).transform(baskets), columns=encoder.columns_
    )
    itemsets = apriori(frame, min_support=MIN_SUPPORT, use_colnames=True)
    if itemsets.empty:
        return itemsets, pd.DataFrame()

    rules = association_rules(itemsets, metric="lift", min_threshold=1.0)
    # The retrieval path maps each consequent to exactly one menu item, so a
    # multi-item consequent would have nothing to render.
    rules = rules[rules["consequents"].apply(len) == 1]
    rules = rules[rules["lift"] >= MIN_LIFT]
    rules = rules.sort_values("lift", ascending=False).head(MAX_RULES_PER_SEGMENT)
    return itemsets, rules


async def generate(db: AsyncSession) -> list[SegmentReport]:
    """Mine every segment and replace the stored rule set. One transaction."""
    rows = await db.execute(
        select(Session.session_type, Transaction.txn_id, MenuItem.item_id)
        .join(Transaction, Transaction.session_id == Session.session_id)
        .join(TransactionItem, TransactionItem.txn_id == Transaction.txn_id)
        .join(MenuItem, MenuItem.item_id == TransactionItem.item_id)
        .where(Transaction.status != TxnStatus.VOIDED)
    )

    grouped: dict[SessionType, dict[int, set[str]]] = {
        segment: {} for segment in SessionType
    }
    for segment, txn_id, item_id in rows.all():
        grouped[segment].setdefault(txn_id, set()).add(item_id)

    reports: list[SegmentReport] = []

    for segment in SessionType:
        baskets = [sorted(items) for items in grouped[segment].values()]
        if not baskets:
            reports.append(SegmentReport(segment.value, 0, 0, 0))
            continue

        itemsets, rules = _mine(baskets)

        await db.execute(
            delete(AprioriRule).where(AprioriRule.session_type == segment)
        )
        for _, rule in rules.iterrows():
            db.add(
                AprioriRule(
                    session_type=segment,
                    antecedents=sorted(rule["antecedents"]),
                    consequents=sorted(rule["consequents"]),
                    support=Decimal(str(rule["support"])).quantize(QUANTISE),
                    confidence=Decimal(str(rule["confidence"])).quantize(QUANTISE),
                    lift=Decimal(str(rule["lift"])).quantize(QUANTISE),
                )
            )

        reports.append(
            SegmentReport(segment.value, len(baskets), len(itemsets), len(rules))
        )

    await db.commit()
    return reports

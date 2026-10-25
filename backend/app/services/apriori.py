from dataclasses import dataclass
from decimal import Decimal

import pandas as pd
from mlxtend.frequent_patterns import apriori, association_rules
from mlxtend.preprocessing import TransactionEncoder
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    AprioriRule,
    AuditLog,
    MenuItem,
    Session,
    Transaction,
    TransactionItem,
)
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


def _mine(baskets: list[list[str]]) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Frequent itemsets to association rules, single-item consequents only."""
    encoder = TransactionEncoder()
    frame = pd.DataFrame(
        encoder.fit(baskets).transform(baskets), columns=encoder.columns_
    )
    itemsets = apriori(frame, min_support=MIN_SUPPORT, use_colnames=True)
    if itemsets.empty:
        return itemsets, pd.DataFrame()

    rules = association_rules(itemsets, metric="lift", min_threshold=1.0)
    rules = rules[rules["consequents"].apply(len) == 1]
    rules = rules[rules["lift"] >= MIN_LIFT]
    rules = rules.sort_values("lift", ascending=False).head(MAX_RULES_PER_SEGMENT)
    return itemsets, rules


# Create
async def generate(
    db: AsyncSession, staff_id: str | None = None
) -> list[SegmentReport]:
    """Mine every segment, replace the stored rule set, and record an audit log entry."""
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

    db.add(
        AuditLog(
            staff_id=staff_id,
            action="apriori_batch_run",
            entity_type="apriori_rules",
            entity_id=None,
            after_state={
                "min_support": MIN_SUPPORT,
                "min_lift": MIN_LIFT,
                "segments": [vars(r) for r in reports],
            },
        )
    )

    # Commit
    await db.commit()
    return reports
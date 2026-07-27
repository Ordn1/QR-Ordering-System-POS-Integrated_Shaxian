from datetime import datetime
from decimal import Decimal
from typing import Any

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.enums import SESSION_TYPE, SessionType
from app.models.keys import key_check, key_default


class AprioriRule(Base):
    __tablename__ = "apriori_rules"
    __table_args__ = (
        key_check("apriori_rules", "rule_id", "APR"),
        sa.CheckConstraint("support >= 0 AND support <= 1", name="chk_apriori_rules_support_range"),
        sa.CheckConstraint(
            "confidence >= 0 AND confidence <= 1",
            name="chk_apriori_rules_confidence_range",
        ),
        sa.CheckConstraint("lift > 0", name="chk_apriori_rules_lift_positive"),
        sa.Index("idx_apriori_segment_lift", "session_type", sa.text("lift DESC")),
        sa.Index("idx_apriori_antecedents", "antecedents", postgresql_using="gin"),
    )

    rule_id: Mapped[str] = mapped_column(
        sa.String(8),
        primary_key=True,
        server_default=key_default("APR", "seq_apriori_rules"),
    )
    session_type: Mapped[SessionType] = mapped_column(SESSION_TYPE, nullable=False)
    antecedents: Mapped[list[Any]] = mapped_column(JSONB, nullable=False)
    consequents: Mapped[list[Any]] = mapped_column(JSONB, nullable=False)
    support: Mapped[Decimal] = mapped_column(sa.Numeric(6, 4), nullable=False)
    confidence: Mapped[Decimal] = mapped_column(sa.Numeric(6, 4), nullable=False)
    lift: Mapped[Decimal] = mapped_column(sa.Numeric(6, 4), nullable=False)
    generated_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )

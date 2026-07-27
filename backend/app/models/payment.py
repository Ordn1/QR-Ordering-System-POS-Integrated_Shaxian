from datetime import datetime
from decimal import Decimal

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.enums import (
    PAYMENT_METHOD,
    PAYMENT_STATUS,
    PRINT_STATUS,
    PaymentMethod,
    PaymentStatus,
    PrintStatus,
)


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = (sa.CheckConstraint("amount > 0", name="chk_payments_amount_positive"),)

    payment_id: Mapped[int] = mapped_column(
        sa.BigInteger,
        sa.Identity(always=True),
        primary_key=True,
    )
    txn_id: Mapped[int] = mapped_column(
        sa.BigInteger,
        sa.ForeignKey("transactions.txn_id", ondelete="CASCADE"),
        nullable=False,
    )
    device_id: Mapped[int | None] = mapped_column(
        sa.BigInteger,
        sa.ForeignKey("session_devices.device_id"),
    )
    method: Mapped[PaymentMethod] = mapped_column(PAYMENT_METHOD, nullable=False)
    amount: Mapped[Decimal] = mapped_column(sa.Numeric(10, 2), nullable=False)
    discount_applied: Mapped[Decimal] = mapped_column(
        sa.Numeric(10, 2),
        nullable=False,
        server_default=sa.text("0"),
    )
    aggregator_ref: Mapped[str | None] = mapped_column(sa.String(50))
    status: Mapped[PaymentStatus] = mapped_column(
        PAYMENT_STATUS,
        nullable=False,
        server_default=PaymentStatus.PENDING.value,
    )
    print_status: Mapped[PrintStatus | None] = mapped_column(PRINT_STATUS)
    paid_at: Mapped[datetime | None] = mapped_column(sa.TIMESTAMP(timezone=True))

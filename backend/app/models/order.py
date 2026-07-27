from datetime import date, datetime
from decimal import Decimal

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import TXN_STATUS, TxnStatus


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        sa.UniqueConstraint("queue_date", "queue_number", name="uq_txn_queue_daily"),
        sa.CheckConstraint("gross_amount >= 0", name="chk_transactions_gross_non_negative"),
        sa.CheckConstraint("net_amount >= 0", name="chk_transactions_net_non_negative"),
        sa.CheckConstraint("item_count > 0", name="chk_transactions_item_count_positive"),
        sa.CheckConstraint("queue_number > 0", name="chk_transactions_queue_number_positive"),
        sa.Index("idx_txn_session", "session_id"),
        sa.Index(
            "idx_txn_status",
            "status",
            postgresql_where=sa.text("status IN ('pending', 'preparing', 'ready')"),
        ),
        sa.Index("idx_txn_placed_at", sa.text("placed_at DESC")),
    )

    txn_id: Mapped[int] = mapped_column(
        sa.BigInteger,
        sa.Identity(always=True),
        primary_key=True,
    )
    session_id: Mapped[int] = mapped_column(
        sa.BigInteger,
        sa.ForeignKey("sessions.session_id"),
        nullable=False,
    )
    placed_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )
    gross_amount: Mapped[Decimal] = mapped_column(sa.Numeric(10, 2), nullable=False)
    vatable_sales: Mapped[Decimal] = mapped_column(
        sa.Numeric(10, 2),
        nullable=False,
        server_default=sa.text("0"),
    )
    vat_exempt_sales: Mapped[Decimal] = mapped_column(
        sa.Numeric(10, 2),
        nullable=False,
        server_default=sa.text("0"),
    )
    vat_amount: Mapped[Decimal] = mapped_column(
        sa.Numeric(10, 2),
        nullable=False,
        server_default=sa.text("0"),
    )
    discount_amount: Mapped[Decimal] = mapped_column(
        sa.Numeric(10, 2),
        nullable=False,
        server_default=sa.text("0"),
    )
    net_amount: Mapped[Decimal] = mapped_column(sa.Numeric(10, 2), nullable=False)
    item_count: Mapped[int] = mapped_column(sa.SmallInteger, nullable=False)
    is_priority: Mapped[bool] = mapped_column(
        sa.Boolean,
        nullable=False,
        server_default=sa.false(),
    )
    queue_date: Mapped[date] = mapped_column(
        sa.Date,
        nullable=False,
        server_default=sa.text("CURRENT_DATE"),
    )
    queue_number: Mapped[int] = mapped_column(sa.SmallInteger, nullable=False)
    status: Mapped[TxnStatus] = mapped_column(
        TXN_STATUS,
        nullable=False,
        server_default=TxnStatus.PENDING.value,
    )
    voided_by: Mapped[str | None] = mapped_column(
        sa.String(8),
        sa.ForeignKey("staff_accounts.staff_id", ondelete="RESTRICT"),
    )
    void_reason: Mapped[str | None] = mapped_column(sa.String(120))
    voided_at: Mapped[datetime | None] = mapped_column(sa.TIMESTAMP(timezone=True))

    items: Mapped[list["TransactionItem"]] = relationship(
        back_populates="transaction",
        cascade="all, delete-orphan",
    )


class TransactionItem(Base):
    __tablename__ = "transaction_items"
    __table_args__ = (
        sa.CheckConstraint("quantity > 0", name="chk_transaction_items_quantity_positive"),
        sa.CheckConstraint("unit_price >= 0", name="chk_transaction_items_unit_price_non_negative"),
        sa.CheckConstraint("subtotal >= 0", name="chk_transaction_items_subtotal_non_negative"),
        sa.Index("idx_txi_txn", "txn_id"),
        sa.Index("idx_txi_item", "item_id"),
    )

    txi_id: Mapped[int] = mapped_column(
        sa.BigInteger,
        sa.Identity(always=True),
        primary_key=True,
    )
    txn_id: Mapped[int] = mapped_column(
        sa.BigInteger,
        sa.ForeignKey("transactions.txn_id", ondelete="CASCADE"),
        nullable=False,
    )
    item_id: Mapped[str] = mapped_column(
        sa.String(8),
        sa.ForeignKey("menu_items.item_id", ondelete="RESTRICT"),
        nullable=False,
    )
    device_id: Mapped[int | None] = mapped_column(
        sa.BigInteger,
        sa.ForeignKey("session_devices.device_id"),
    )
    quantity: Mapped[int] = mapped_column(sa.SmallInteger, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(sa.Numeric(8, 2), nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(sa.Numeric(10, 2), nullable=False)
    is_discounted: Mapped[bool] = mapped_column(
        sa.Boolean,
        nullable=False,
        server_default=sa.false(),
    )
    discount_amount: Mapped[Decimal] = mapped_column(
        sa.Numeric(8, 2),
        nullable=False,
        server_default=sa.text("0"),
    )

    transaction: Mapped[Transaction] = relationship(back_populates="items")

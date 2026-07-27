from datetime import datetime
from decimal import Decimal

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.keys import key_check, key_default


class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (key_check("categories", "cat_id", "CAT"),)

    cat_id: Mapped[str] = mapped_column(
        sa.String(8),
        primary_key=True,
        server_default=key_default("CAT", "seq_categories"),
    )
    name_en: Mapped[str] = mapped_column(sa.String(40), nullable=False)
    name_fil: Mapped[str] = mapped_column(sa.String(40), nullable=False)
    name_bis: Mapped[str] = mapped_column(sa.String(40), nullable=False)
    display_order: Mapped[int] = mapped_column(
        sa.SmallInteger,
        nullable=False,
        server_default=sa.text("0"),
    )
    is_active: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, server_default=sa.true())

    items: Mapped[list["MenuItem"]] = relationship(back_populates="category")


class MenuItem(Base):
    __tablename__ = "menu_items"
    __table_args__ = (
        key_check("menu_items", "item_id", "MNU"),
        sa.CheckConstraint("price >= 0", name="chk_menu_items_price_non_negative"),
        sa.CheckConstraint("calories >= 0", name="chk_menu_items_calories_non_negative"),
    )

    item_id: Mapped[str] = mapped_column(
        sa.String(8),
        primary_key=True,
        server_default=key_default("MNU", "seq_menu_items"),
    )
    cat_id: Mapped[str] = mapped_column(
        sa.String(8),
        sa.ForeignKey("categories.cat_id", ondelete="RESTRICT"),
        nullable=False,
    )
    name_en: Mapped[str] = mapped_column(sa.String(60), nullable=False)
    name_fil: Mapped[str] = mapped_column(sa.String(60), nullable=False)
    name_bis: Mapped[str] = mapped_column(sa.String(60), nullable=False)
    description_en: Mapped[str | None] = mapped_column(sa.String(160))
    description_fil: Mapped[str | None] = mapped_column(sa.String(160))
    description_bis: Mapped[str | None] = mapped_column(sa.String(160))
    price: Mapped[Decimal] = mapped_column(sa.Numeric(8, 2), nullable=False)
    calories: Mapped[int | None] = mapped_column(sa.SmallInteger)
    allergens: Mapped[str | None] = mapped_column(sa.String(120))
    dietary_flags: Mapped[str | None] = mapped_column(sa.String(60))
    image_filename: Mapped[str | None] = mapped_column(sa.String(80))
    is_available: Mapped[bool] = mapped_column(
        sa.Boolean,
        nullable=False,
        server_default=sa.true(),
    )
    is_featured: Mapped[bool] = mapped_column(
        sa.Boolean,
        nullable=False,
        server_default=sa.false(),
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.func.now(),
    )

    category: Mapped[Category] = relationship(back_populates="items")

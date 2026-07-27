from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessRuleError, ConflictError, NotFoundError
from app.models import Category, MenuItem, TransactionItem
from app.schemas.menu import CategoryWrite, MenuItemWrite


async def list_categories(db: AsyncSession, *, active_only: bool = False) -> list[Category]:
    statement = select(Category).order_by(Category.display_order, Category.cat_id)
    if active_only:
        statement = statement.where(Category.is_active.is_(True))
    return list(await db.scalars(statement))


async def get_category(db: AsyncSession, cat_id: str) -> Category:
    category = await db.get(Category, cat_id)
    if category is None:
        raise NotFoundError("That category no longer exists. Refresh the list.")
    return category


async def create_category(db: AsyncSession, payload: CategoryWrite) -> Category:
    """Create a category, rejecting a duplicate English name."""
    await guard_category_name(db, payload.name_en)

    category = Category(**payload.model_dump())
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


async def update_category(db: AsyncSession, cat_id: str, payload: CategoryWrite) -> Category:
    category = await get_category(db, cat_id)
    await guard_category_name(db, payload.name_en, exclude=cat_id)

    for field, value in payload.model_dump().items():
        setattr(category, field, value)

    await db.commit()
    await db.refresh(category)
    return category


async def delete_category(db: AsyncSession, cat_id: str) -> None:
    """Delete a category, refusing while it still holds menu items."""
    category = await get_category(db, cat_id)

    held = await db.scalar(
        select(func.count()).select_from(MenuItem).where(MenuItem.cat_id == cat_id)
    )
    if held:
        raise BusinessRuleError(
            f"{category.name_en} still holds {held} menu "
            f"{'item' if held == 1 else 'items'}. Move or delete them first."
        )

    await db.delete(category)
    await db.commit()


async def guard_category_name(
    db: AsyncSession, name_en: str, *, exclude: str | None = None
) -> None:
    statement = select(Category.cat_id).where(func.lower(Category.name_en) == name_en.lower())
    if exclude:
        statement = statement.where(Category.cat_id != exclude)

    if await db.scalar(statement):
        raise ConflictError(f"A category named '{name_en}' already exists.")


async def list_items(db: AsyncSession, *, available_only: bool = False) -> list[MenuItem]:
    statement = select(MenuItem).order_by(MenuItem.item_id)
    if available_only:
        statement = statement.where(MenuItem.is_available.is_(True))
    return list(await db.scalars(statement))


async def get_item(db: AsyncSession, item_id: str) -> MenuItem:
    item = await db.get(MenuItem, item_id)
    if item is None:
        raise NotFoundError("That menu item no longer exists. Refresh the list.")
    return item


async def create_item(db: AsyncSession, payload: MenuItemWrite) -> MenuItem:
    """Create a menu item, rejecting a duplicate English name."""
    await get_category(db, payload.cat_id)
    await guard_item_name(db, payload.name_en)

    item = MenuItem(**payload.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


async def update_item(db: AsyncSession, item_id: str, payload: MenuItemWrite) -> MenuItem:
    item = await get_item(db, item_id)
    await get_category(db, payload.cat_id)
    await guard_item_name(db, payload.name_en, exclude=item_id)

    for field, value in payload.model_dump().items():
        setattr(item, field, value)

    await db.commit()
    await db.refresh(item)
    return item


async def delete_item(db: AsyncSession, item_id: str) -> None:
    """Delete a menu item, refusing once it appears in order history."""
    item = await get_item(db, item_id)

    ordered = await db.scalar(
        select(func.count()).select_from(TransactionItem).where(TransactionItem.item_id == item_id)
    )
    if ordered:
        raise BusinessRuleError(
            f"{item.name_en} appears in past orders and cannot be deleted. "
            "Mark it sold out instead."
        )

    await db.delete(item)
    await db.commit()


async def guard_item_name(db: AsyncSession, name_en: str, *, exclude: str | None = None) -> None:
    statement = select(MenuItem.item_id).where(func.lower(MenuItem.name_en) == name_en.lower())
    if exclude:
        statement = statement.where(MenuItem.item_id != exclude)

    if await db.scalar(statement):
        raise ConflictError(f"A menu item named '{name_en}' already exists.")

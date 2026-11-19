from fastapi import APIRouter

from app.core.deps import AdminStaff, AnyStaff, DbSession
from app.schemas.menu import (
    CategoryRead,
    CategoryWrite,
    MenuItemAvailabilityWrite,
    MenuItemRead,
    MenuItemWrite,
)
from app.services import menu as menu_service

router = APIRouter(prefix="/api/v1/menu", tags=["menu"])


@router.get("/categories", response_model=list[CategoryRead])
async def list_categories(db: DbSession, active_only: bool = False) -> list[CategoryRead]:
    categories = await menu_service.list_categories(db, active_only=active_only)
    return [CategoryRead.model_validate(category) for category in categories]


@router.post("/categories", response_model=CategoryRead, status_code=201)
async def create_category(
    payload: CategoryWrite, db: DbSession, staff: AdminStaff
) -> CategoryRead:
    category = await menu_service.create_category(db, payload)
    return CategoryRead.model_validate(category)


@router.patch("/categories/{cat_id}", response_model=CategoryRead)
async def update_category(
    cat_id: str, payload: CategoryWrite, db: DbSession, staff: AdminStaff
) -> CategoryRead:
    category = await menu_service.update_category(db, cat_id, payload)
    return CategoryRead.model_validate(category)


@router.delete("/categories/{cat_id}", status_code=204)
async def delete_category(cat_id: str, db: DbSession, staff: AdminStaff) -> None:
    await menu_service.delete_category(db, cat_id)


@router.get("/items", response_model=list[MenuItemRead])
async def list_items(db: DbSession, available_only: bool = False) -> list[MenuItemRead]:
    items = await menu_service.list_items(db, available_only=available_only)
    return [MenuItemRead.model_validate(item) for item in items]


@router.get("/images", response_model=list[str])
async def list_images(staff: AnyStaff) -> list[str]:
    return menu_service.list_available_images()


@router.post("/items", response_model=MenuItemRead, status_code=201)
async def create_item(
    payload: MenuItemWrite, db: DbSession, staff: AdminStaff
) -> MenuItemRead:
    item = await menu_service.create_item(db, payload)
    return MenuItemRead.model_validate(item)


@router.patch("/items/{item_id}", response_model=MenuItemRead)
async def update_item(
    item_id: str, payload: MenuItemWrite, db: DbSession, staff: AdminStaff
) -> MenuItemRead:
    item = await menu_service.update_item(db, item_id, payload, staff_id=staff.staff_id)
    return MenuItemRead.model_validate(item)


@router.patch("/items/{item_id}/availability", response_model=MenuItemRead)
async def toggle_item_availability(
    item_id: str, payload: MenuItemAvailabilityWrite, db: DbSession, staff: AnyStaff
) -> MenuItemRead:
    item = await menu_service.toggle_availability(
        db, item_id, payload.is_available, staff_id=staff.staff_id
    )
    return MenuItemRead.model_validate(item)


@router.delete("/items/{item_id}", status_code=204)
async def delete_item(item_id: str, db: DbSession, staff: AdminStaff) -> None:
    await menu_service.delete_item(db, item_id)
from fastapi import APIRouter, Response

from app.config import settings
from app.core.deps import AdminStaff, CurrentStaff, DbSession
from app.core.security import COOKIE_NAME, create_access_token
from app.schemas.auth import (
    LoginRequest,
    StaffAccountRead,
    StaffCreate,
    StaffRead,
    StaffStatusWrite,
    StaffUpdate,
)
from app.services import auth as auth_service

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/login", response_model=StaffRead)
async def login(payload: LoginRequest, response: Response, db: DbSession) -> StaffRead:
    staff = await auth_service.authenticate(db, payload.username, payload.password)
    token = create_access_token(staff.staff_id, staff.role.value)

    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="strict",
        secure=False,
        max_age=settings.ACCESS_TOKEN_HOURS * 3600,
        path="/",
    )

    return StaffRead.model_validate(staff)


@router.post("/logout", status_code=204)
async def logout(response: Response) -> None:
    response.delete_cookie(key=COOKIE_NAME, path="/", httponly=True, samesite="strict")


@router.get("/me", response_model=StaffRead)
async def me(staff: CurrentStaff) -> StaffRead:
    return StaffRead.model_validate(staff)


@router.get("/staff", response_model=list[StaffAccountRead])
async def list_staff(
    db: DbSession, staff: AdminStaff, active_only: bool = False
) -> list[StaffAccountRead]:
    accounts = await auth_service.list_staff(db, active_only=active_only)
    return [StaffAccountRead.model_validate(account) for account in accounts]


@router.post("/staff", response_model=StaffAccountRead, status_code=201)
async def create_staff(
    payload: StaffCreate, db: DbSession, staff: AdminStaff
) -> StaffAccountRead:
    account = await auth_service.create_staff(db, payload, actor_id=staff.staff_id)
    return StaffAccountRead.model_validate(account)


@router.patch("/staff/{staff_id}", response_model=StaffAccountRead)
async def update_staff(
    staff_id: str, payload: StaffUpdate, db: DbSession, staff: AdminStaff
) -> StaffAccountRead:
    account = await auth_service.update_staff(
        db, staff_id, payload, actor_id=staff.staff_id
    )
    return StaffAccountRead.model_validate(account)


@router.patch("/staff/{staff_id}/status", response_model=StaffAccountRead)
async def toggle_staff_status(
    staff_id: str, payload: StaffStatusWrite, db: DbSession, staff: AdminStaff
) -> StaffAccountRead:
    account = await auth_service.toggle_staff_status(
        db, staff_id, payload.is_active, actor_id=staff.staff_id
    )
    return StaffAccountRead.model_validate(account)


@router.delete("/staff/{staff_id}", status_code=204)
async def delete_staff(
    staff_id: str, db: DbSession, staff: AdminStaff
) -> None:
    await auth_service.delete_staff(db, staff_id, actor_id=staff.staff_id)
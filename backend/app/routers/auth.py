from fastapi import APIRouter, Response

from app.config import settings
from app.core.deps import CurrentStaff, DbSession
from app.core.security import COOKIE_NAME, create_access_token
from app.schemas.auth import LoginRequest, StaffRead
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

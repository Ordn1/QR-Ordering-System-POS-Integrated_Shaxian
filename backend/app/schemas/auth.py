from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.security import BCRYPT_MAX_BYTES
from app.models.enums import StaffRole
from app.schemas.fields import ALPHA, ALPHANUMERIC, sized

Username = sized(30, ALPHANUMERIC)
FullName = sized(80, ALPHA)
StaffPassword = Field(min_length=12, max_length=BCRYPT_MAX_BYTES)


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=30)
    password: str = Field(min_length=1, max_length=BCRYPT_MAX_BYTES)


class StaffRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    staff_id: str
    username: str
    full_name: str
    role: StaffRole


class StaffAccountRead(StaffRead):
    is_active: bool
    last_login_at: datetime | None = None
    created_at: datetime


class StaffCreate(BaseModel):
    username: Username
    full_name: FullName
    role: StaffRole = StaffRole.SERVICE_CREW
    password: str = StaffPassword
    is_active: bool = True


class StaffUpdate(BaseModel):
    username: Username
    full_name: FullName
    role: StaffRole
    password: str | None = Field(default=None, min_length=12, max_length=BCRYPT_MAX_BYTES)
    is_active: bool = True


class StaffStatusWrite(BaseModel):
    is_active: bool
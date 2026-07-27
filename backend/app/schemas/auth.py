from pydantic import BaseModel, ConfigDict, Field

from app.core.security import BCRYPT_MAX_BYTES
from app.models.enums import StaffRole


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=30)
    password: str = Field(min_length=1, max_length=BCRYPT_MAX_BYTES)


class StaffRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    staff_id: str
    username: str
    full_name: str
    role: StaffRole

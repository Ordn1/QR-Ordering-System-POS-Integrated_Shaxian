from decimal import Decimal
from pathlib import Path
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

_ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"
_BACKEND_ENV = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(_ROOT_ENV), str(_BACKEND_ENV), ".env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    DATABASE_URL: str
    SECRET_KEY: str
    CORS_ORIGINS: Annotated[list[str], NoDecode] = ["http://localhost:5173"]

    ACCESS_TOKEN_HOURS: int = 8
    BCRYPT_ROUNDS: int = 12

    VAT_RATE: Decimal = Decimal("0.12")
    STATUTORY_DISCOUNT: Decimal = Decimal("0.20")

    MAX_PRIORITY_SKIPS: int = 3

    DWELL_THRESHOLD_SEC: int = 45
    BACKNAV_THRESHOLD: int = 3
    CONFUSION_WINDOW_SEC: int = 120
    CONFUSION_COOLDOWN_SEC: int = 180
    CONFUSION_MAX_PER_SESSION: int = 3

    SESSION_MAX_AGE_HOURS: int = 3

    MENU_IMAGE_DIR: str = "menu"
    FRONTEND_BASE_URL: str = "http://localhost:5173"
    PAYMONGO_SECRET_KEY: str = ""

    # The register the POS bridge transmits to. Points at this server's own
    # simulated terminal; a real deployment repoints it at the counter's register.
    POS_ENDPOINT: str = "http://127.0.0.1:8001/api/v1/pos/register/inbox"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def split_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


settings = Settings()
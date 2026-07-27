from decimal import Decimal
from pathlib import Path
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
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

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def split_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


settings = Settings()

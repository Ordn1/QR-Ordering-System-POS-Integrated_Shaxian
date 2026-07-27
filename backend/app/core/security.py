from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from app.config import settings

ALGORITHM = "HS256"
COOKIE_NAME = "shaxian_session"
BCRYPT_MAX_BYTES = 72


def hash_password(plaintext: str) -> str:
    return bcrypt.hashpw(
        plaintext.encode("utf-8"),
        bcrypt.gensalt(rounds=settings.BCRYPT_ROUNDS),
    ).decode("utf-8")


def verify_password(plaintext: str, password_hash: str) -> bool:
    return bcrypt.checkpw(plaintext.encode("utf-8"), password_hash.encode("utf-8"))


def create_access_token(staff_id: str, role: str) -> str:
    issued = datetime.now(UTC)
    payload = {
        "sub": staff_id,
        "role": role,
        "iat": issued,
        "exp": issued + timedelta(hours=settings.ACCESS_TOKEN_HOURS),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict[str, str]:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])

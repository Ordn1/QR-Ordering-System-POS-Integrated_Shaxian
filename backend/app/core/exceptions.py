import logging
import secrets

from fastapi import Request
from fastapi.responses import JSONResponse

logger = logging.getLogger("shaxian")


class AppError(Exception):
    status_code = 400

    def __init__(self, message: str, field_errors: dict[str, str] | None = None):
        super().__init__(message)
        self.message = message
        self.field_errors = field_errors


class ValidationError(AppError):
    status_code = 422


class NotFoundError(AppError):
    status_code = 404


class ConflictError(AppError):
    status_code = 409


class PermissionError(AppError):
    status_code = 403


class AuthenticationError(AppError):
    status_code = 401


class BusinessRuleError(AppError):
    status_code = 400


def correlation_id() -> str:
    raw = secrets.token_hex(4).upper()
    return f"{raw[:4]}-{raw[4:]}"


async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
    body: dict[str, object] = {"message": exc.message}
    if exc.field_errors:
        body["field_errors"] = exc.field_errors
    return JSONResponse(status_code=exc.status_code, content=body)


async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    reference = correlation_id()
    logger.exception("unhandled error reference=%s path=%s", reference, request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "message": f"Something interrupted this action. Reference: {reference}",
            "reference": reference,
        },
    )

from typing import Annotated, Any

from fastapi import APIRouter, Header, Request

from app.core.deps import DbSession
from app.services import payment as payment_service

router = APIRouter(prefix="/api/v1/webhooks", tags=["webhooks"])


@router.post("/paymongo")
async def paymongo_webhook(
    request: Request,
    db: DbSession,
    paymongo_signature: Annotated[
        str | None, Header(alias="Paymongo-Signature")
    ] = None,
) -> dict[str, Any]:
    raw_body = await request.body()
    return await payment_service.process_paymongo_webhook(
        db, raw_body, signature_header=paymongo_signature
    )
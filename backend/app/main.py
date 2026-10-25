import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
import logging
from zoneinfo import ZoneInfo

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.requests import Request

from app.config import settings
from app.core.exceptions import AppError, handle_app_error, handle_unexpected_error
from app.database import SessionFactory
from app.routers import (
    auth,
    menu,
    orders,
    pos,
    queue,
    realtime,
    recommendations,
    sessions,
    tables,
    webhooks,
)
from app.services import apriori as apriori_service

logger = logging.getLogger("shaxian")
MANILA = ZoneInfo("Asia/Manila")


async def _nightly_apriori_loop() -> None:
    while True:
        now = datetime.now(MANILA)
        next_midnight = (now + timedelta(days=1)).replace(
            hour=0, minute=0, second=5, microsecond=0
        )
        sleep_seconds = max(60.0, (next_midnight - now).total_seconds())
        try:
            await asyncio.sleep(sleep_seconds)
            async with SessionFactory() as session:
                reports = await apriori_service.generate(session, staff_id=None)
            total = sum(r.rules for r in reports)
            logger.info("Nightly Apriori batch job completed: %s rules generated", total)
        except asyncio.CancelledError:
            break
        except Exception:  # noqa: BLE001
            logger.exception("Nightly Apriori batch job failed")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    task = asyncio.create_task(_nightly_apriori_loop())
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="Shaxian QR Table Ordering", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(menu.router)
app.include_router(orders.router)
app.include_router(orders.orders_router)
app.include_router(sessions.router)
app.include_router(tables.router)
app.include_router(queue.router)
app.include_router(recommendations.router)
app.include_router(pos.router)
app.include_router(webhooks.router)
app.include_router(realtime.router)


@app.exception_handler(RequestValidationError)
async def handle_request_validation(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    field_errors = {
        str(error["loc"][-1]): error["msg"] for error in exc.errors() if error.get("loc")
    }
    return JSONResponse(
        status_code=422,
        content={"message": "Check the highlighted fields.", "field_errors": field_errors},
    )


app.add_exception_handler(AppError, handle_app_error)
app.add_exception_handler(Exception, handle_unexpected_error)
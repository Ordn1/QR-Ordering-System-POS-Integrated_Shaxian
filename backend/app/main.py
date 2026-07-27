from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.requests import Request

from app.config import settings
from app.core.exceptions import AppError, handle_app_error, handle_unexpected_error
from app.routers import auth, menu, orders, queue, realtime, recommendations, sessions

app = FastAPI(title="Shaxian QR Table Ordering")

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
app.include_router(queue.router)
app.include_router(recommendations.router)
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

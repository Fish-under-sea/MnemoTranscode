"""全局异常处理器注册。"""

from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.exceptions import MTCDomainError

logger = logging.getLogger(__name__)

STATUS_TO_CODE_FALLBACK: dict[int, str] = {
    401: "AUTH_UNAUTHORIZED",
    403: "AUTH_FORBIDDEN",
    404: "RESOURCE_NOT_FOUND",
    405: "VALIDATION_METHOD_NOT_ALLOWED",
    409: "RESOURCE_CONFLICT",
    422: "VALIDATION_FAILED",
    429: "RATE_LIMIT_EXCEEDED",
    500: "INTERNAL_SERVER_ERROR",
    503: "SERVICE_UNAVAILABLE",
}


def _request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "unknown-request-id")


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(MTCDomainError)
    async def handle_domain_error(request: Request, exc: MTCDomainError):
        rid = _request_id(request)
        return JSONResponse(
            status_code=exc.http_status,
            content={
                "error_code": exc.error_code,
                "message": exc.message,
                "fields": exc.fields,
                "request_id": rid,
            },
            headers={"X-Request-ID": rid},
        )

    @app.exception_handler(HTTPException)
    async def handle_http_exception(request: Request, exc: HTTPException):
        rid = _request_id(request)
        code = STATUS_TO_CODE_FALLBACK.get(exc.status_code, f"HTTP_{exc.status_code}")
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error_code": code,
                "message": str(exc.detail),
                "request_id": rid,
            },
            headers={"X-Request-ID": rid},
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError):
        rid = _request_id(request)
        fields = sorted({str(err["loc"][-1]) for err in exc.errors()})
        return JSONResponse(
            status_code=422,
            content={
                "error_code": "VALIDATION_FAILED",
                "message": "请求参数校验失败",
                "fields": fields,
                "request_id": rid,
            },
            headers={"X-Request-ID": rid},
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception):
        rid = _request_id(request)
        logger.exception("Unhandled exception", extra={"request_id": rid})
        return JSONResponse(
            status_code=500,
            content={
                "error_code": "INTERNAL_SERVER_ERROR",
                "message": "服务内部错误",
                "request_id": rid,
            },
            headers={"X-Request-ID": rid},
        )


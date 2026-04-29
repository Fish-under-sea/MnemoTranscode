"""全局异常处理器注册。"""

from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import OperationalError
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


def _looks_like_db_unreachable(exc: BaseException) -> bool:
    """覆盖 SQLAlchemy OperationalError、asyncpg 嵌套、原生 ConnectionRefusedError 等链路。"""
    if isinstance(exc, OperationalError):
        return True
    seen: set[int] = set()
    stack: list[BaseException] = [exc]
    while stack:
        e = stack.pop()
        eid = id(e)
        if eid in seen:
            continue
        seen.add(eid)
        if isinstance(e, OperationalError):
            return True
        if isinstance(e, ConnectionRefusedError):
            return True
        tn = type(e).__name__
        if tn in ("CannotConnectNowError", "ConnectionDoesNotExistError"):
            return True
        if isinstance(e, OSError) and getattr(e, "winerror", None) == 1225:
            return True  # Windows「远程计算机拒绝网络连接」常与 Docker 端口未转到本机有关
        for child in (e.__cause__, e.__context__):
            if child is not None:
                stack.append(child)
    return False


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
        if _looks_like_db_unreachable(exc):
            logger.warning(
                "数据库暂不可用（连接类异常，已返回 503）",
                extra={"request_id": rid},
                exc_info=exc,
            )
            return JSONResponse(
                status_code=503,
                content={
                    "error_code": "SERVICE_UNAVAILABLE",
                    "message": (
                        "数据库暂时无法连接。请在本机确认 Docker 中的 PostgreSQL 已启动"
                        "（例如在仓库 infra 目录执行：docker compose up -d postgres），"
                        "若使用 Docker Desktop + WSL 且为本机后端连 localhost:5432，"
                        "请检查端口转发或使用 WSL 内启动后端。"
                    ),
                    "request_id": rid,
                },
                headers={"X-Request-ID": rid},
            )
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


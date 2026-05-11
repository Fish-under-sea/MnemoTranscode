"""
FastAPI 应用入口

MTC (Memory To Code) - AI 记忆银行核心应用
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api.middleware.exception_handlers import register_exception_handlers
from app.api.middleware.request_id import RequestIDMiddleware
from app.core.config import get_settings
from app.core.database import engine
from app.api.v1 import (
    auth,
    memory,
    archive,
    dialogue,
    media,
    capsule,
    storybook,
    kourichat,
    usage,
    preferences,
    ai_memory,
    llm_probe,
)

settings = get_settings()

# CORS：合并显式 Origin + 可选私网放行（局域网访问 :8000 的浏览器请求）
_cors_origins = list(dict.fromkeys(settings.cors_origins))
for item in (x.strip() for x in settings.cors_extra_origins.split(",")):
    if item:
        _cors_origins.append(item)
_cors_origins = list(dict.fromkeys(_cors_origins))

_cors_origin_regex = None
if settings.cors_allow_private_lan:
    # localhost / 私网 IPv4 + 可选端口（与 credentials 共存须用 regex 匹配 Origin）
    _cors_origin_regex = (
        r"^https?://("
        r"localhost|127\.0\.0\.1|\[::1\]|::1|"
        r"192\.168\.\d{1,3}\.\d{1,3}|"
        r"10\.\d{1,3}\.\d{1,3}\.\d{1,3}|"
        r"172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}"
        r")(:\d+)?$" 
    )

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    logger.info(f"启动 {settings.app_name} v{settings.app_version}")
    yield
    logger.info("应用关闭")


app = FastAPI(
    title=settings.app_name,
    description="""
    MTC（Memory To Code）— AI 记忆银行核心 API

    用 AI 技术将记忆（声音、照片、文字、情感）进行数字化存档、智能化整理和多模态还原。

    ## 核心能力

    - **多类型档案**：支持家族、恋人、挚友、至亲、伟人、国家历史等多种记忆档案
    - **多渠道对话**：原生应用内对话、微信聊天转接、QQ 聊天转接（待开发）
    - **AI 记忆整理**：LLM 自动总结、归类、时间线重建
    - **情感识别**：NLP 情绪标注与情感分析
    - **声音克隆**：TTS + 声纹迁移，还原亲人声音
    - **记忆胶囊**：定时解封，实现跨代传承
    """,
    version=settings.app_version,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=_cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestIDMiddleware)
register_exception_handlers(app)


# 注册路由
app.include_router(auth.router, prefix="/api/v1")
app.include_router(archive.router, prefix="/api/v1")
app.include_router(memory.router, prefix="/api/v1")
app.include_router(dialogue.router, prefix="/api/v1")
app.include_router(media.router, prefix="/api/v1")
app.include_router(capsule.router, prefix="/api/v1")
app.include_router(storybook.router, prefix="/api/v1")
app.include_router(kourichat.router, prefix="/api/v1")
app.include_router(usage.router, prefix="/api/v1")
app.include_router(preferences.router, prefix="/api/v1")
app.include_router(ai_memory.router, prefix="/api/v1")
app.include_router(llm_probe.router, prefix="/api/v1")


@app.get("/")
async def root():
    """根路径"""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy"}


@app.get("/healthz")
async def healthz():
    """依赖级健康检查（DB + 配置可用性）"""
    checks = {"config": "ok"}
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["db"] = "ok"
    except Exception as exc:
        checks["db"] = f"fail: {exc.__class__.__name__}"

    is_ok = all(value == "ok" for value in checks.values())
    return JSONResponse(
        status_code=200 if is_ok else 503,
        content={"status": "ok" if is_ok else "degraded", "checks": checks},
    )

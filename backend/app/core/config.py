"""
核心配置模块

所有环境变量和运行时配置集中管理
"""

from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """应用配置"""

    # 应用基础
    app_name: str = "MTC - Memory To Code"
    app_version: str = "0.1.0"
    debug: bool = False
    # 浏览器可访问的 API 根，用于头像等绝对链（如 https://api.example.com）。空则仅返回以 / 开头的 path，依赖前端同源/反代
    app_public_origin: str = ""

    # 数据库
    database_url: str = "postgresql+asyncpg://mtc:mtc_password@localhost:5432/mtc_db"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # 向量数据库
    qdrant_url: str = "http://localhost:6333"
    qdrant_collection: str = "mtc_memories"

    # LLM 配置（环境变量支持 LLM_API_KEY 或常见的 OPENAI_API_KEY）
    llm_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("LLM_API_KEY", "OPENAI_API_KEY"),
    )
    llm_base_url: str = Field(
        default="https://api.openai.com/v1",
        validation_alias=AliasChoices("LLM_BASE_URL", "OPENAI_BASE_URL"),
    )
    llm_model: str = "gpt-4o"
    llm_max_tokens: int = 4000
    llm_temperature: float = 0.7

    # Whisper STT
    whisper_api_key: str = ""
    whisper_base_url: str = "https://api.openai.com/v1"
    whisper_model: str = "whisper-1"

    # TTS / 声音克隆
    tts_api_key: str = ""
    tts_base_url: str = "https://api.elevenlabs.io/v1"
    tts_model: str = "eleven_monolingual_v1"

    # CosyVoice (阿里开源)
    cosyvoice_url: str = "http://localhost:5000"
    cosyvoice_api_key: str = ""
    cosyvoice_connect_timeout_seconds: int = 3
    cosyvoice_read_timeout_seconds: int = 45
    cosyvoice_retry_count: int = 2
    cosyvoice_retry_backoff_base_ms: int = 200
    cosyvoice_retry_backoff_factor: int = 2

    # MinIO / 对象存储
    # 服务端连接（Docker 内一般为 minio:9000；本机开发多为 localhost:9000）
    minio_endpoint: str = "localhost:9000"
    # 浏览器可访问的 MinIO 主机:端口，用于预签名 URL（宿主机浏览器无法解析容器名 minio，须用 localhost/127.0.0.1）
    # 空时：与 minio_endpoint 相同，但若 minio_endpoint 为 minio:9000，头像模块会自动改用 127.0.0.1:同端口
    minio_public_endpoint: str = ""
    minio_access_key: str = "mtc_access_key"
    minio_secret_key: str = "mtc_secret_key"
    minio_bucket: str = "mtc-media"
    minio_secure: bool = False
    # 头像预签名 GET 有效期（小时）；过短会导致浏览器中头像链接过期失效
    minio_presign_avatar_hours: int = 720

    # JWT 鉴权
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24小时

    # CORS（含 127.0.0.1：用户用该地址打开前端时直连 API 需放行）
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # 向量嵌入模型
    embedding_model: str = "text-embedding-3-small"
    embedding_dim: int = 1536

    # 情感分析模型
    emotion_model: str = "deepctrl/sentiment-analysis-distilbert-zh"

    # Voice 业务约束
    voice_default_provider: str = "cosyvoice"
    voice_feature_clone_enabled: bool = False
    voice_max_text_length: int = 2000
    voice_max_concurrent_tts: int = 10

    # Celery
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # MnemoTranscode（图记忆 + 扩散激活 + 意识召回）；失败时对话路由自动回退传统模式
    mnemo_transcode_enabled: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """获取缓存的配置实例"""
    return Settings()

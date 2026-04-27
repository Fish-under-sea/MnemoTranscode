"""
核心配置模块

所有环境变量和运行时配置集中管理
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """应用配置"""

    # 应用基础
    app_name: str = "MTC - Memory To Code"
    app_version: str = "0.1.0"
    debug: bool = False

    # 数据库
    database_url: str = "postgresql+asyncpg://mtc:mtc_password@localhost:5432/mtc_db"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # 向量数据库
    qdrant_url: str = "http://localhost:6333"
    qdrant_collection: str = "mtc_memories"

    # LLM 配置
    llm_api_key: str = ""
    llm_base_url: str = "https://api.openai.com/v1"
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

    # MinIO / 对象存储
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "mtc_access_key"
    minio_secret_key: str = "mtc_secret_key"
    minio_bucket: str = "mtc-media"
    minio_secure: bool = False

    # JWT 鉴权
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24小时

    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # 向量嵌入模型
    embedding_model: str = "text-embedding-3-small"
    embedding_dim: int = 1536

    # 情感分析模型
    emotion_model: str = "deepctrl/sentiment-analysis-distilbert-zh"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    """获取缓存的配置实例"""
    return Settings()

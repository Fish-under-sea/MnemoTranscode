"""
浏览器端传入的 LLM 连接信息（OpenAI 兼容 chat/completions）
用于对话、故事书等：与「模型设置」页 localStorage 配置对齐，
避免仅能依赖服务端 .env 导致自定义网关（如 MiMo）不可用。
"""

from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator


class ClientLlmOverride(BaseModel):
    """单次请求可用的 LLM 覆盖配置"""

    base_url: str = Field(..., min_length=10, max_length=512)
    api_key: str | None = None
    model: str = Field(..., min_length=1, max_length=256)

    @field_validator("base_url")
    @classmethod
    def strip_and_check_scheme(cls, v: str) -> str:
        s = v.strip().rstrip("/")
        parsed = urlparse(s)
        if parsed.scheme not in ("http", "https"):
            raise ValueError("base_url 仅支持 http 或 https")
        if not parsed.netloc:
            raise ValueError("base_url 无效：缺少主机名")
        return s

    @field_validator("model")
    @classmethod
    def strip_model(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("model 不能为空")
        return s

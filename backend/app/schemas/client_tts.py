"""浏览器「语音合成 · TTS」页 localStorage 对应的一次请求载荷（与服务端网关对齐）。"""

from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator


class ClientTtsOverride(BaseModel):
    """单次 TTS：OpenAI `/v1/audio/speech` 兼容（部分厂商同源不同 model）"""

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

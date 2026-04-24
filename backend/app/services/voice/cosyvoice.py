"""CosyVoice provider 实现。"""

from __future__ import annotations

import random
import asyncio

import httpx

from app.core.config import get_settings
from app.core.exceptions import DomainInternalError, DomainMediaError
from app.services.voice.provider import VoiceProvider


class CosyVoiceProvider(VoiceProvider):
    def __init__(self) -> None:
        settings = get_settings()
        self.base_url = settings.cosyvoice_url.rstrip("/")
        self.api_key = getattr(settings, "cosyvoice_api_key", "")
        self.connect_timeout = getattr(settings, "cosyvoice_connect_timeout_seconds", 3)
        self.read_timeout = getattr(settings, "cosyvoice_read_timeout_seconds", 45)
        self.retry_count = getattr(settings, "cosyvoice_retry_count", 2)
        self.retry_base_ms = getattr(settings, "cosyvoice_retry_backoff_base_ms", 200)
        self.retry_factor = getattr(settings, "cosyvoice_retry_backoff_factor", 2)

    async def synthesize(self, text: str, voice_id: str | None = None, **options) -> bytes:
        timeout = httpx.Timeout(
            connect=float(self.connect_timeout),
            read=float(self.read_timeout),
            write=10.0,
            pool=5.0,
        )
        headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
        payload = {"text": text, "voice_id": voice_id}

        last_error: Exception | None = None
        for attempt in range(self.retry_count + 1):
            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    response = await client.post(f"{self.base_url}/tts", json=payload, headers=headers)
                    if response.status_code >= 500:
                        raise DomainMediaError(
                            error_code="MEDIA_TTS_PROVIDER_UNAVAILABLE",
                            message=f"TTS provider 5xx: {response.status_code}",
                        )
                    if response.status_code >= 400:
                        raise DomainMediaError(
                            error_code="MEDIA_TTS_BAD_REQUEST",
                            message=f"TTS provider 4xx: {response.status_code}",
                        )
                    return response.content
            except DomainMediaError as exc:
                last_error = exc
                if exc.error_code == "MEDIA_TTS_BAD_REQUEST":
                    raise
            except httpx.ReadTimeout as exc:
                last_error = DomainMediaError("MEDIA_TTS_TIMEOUT", "TTS 调用超时")
            except Exception as exc:
                last_error = exc

            if attempt < self.retry_count:
                wait_ms = int(self.retry_base_ms * (self.retry_factor**attempt) + random.randint(-50, 50))
                await asyncio.sleep(max(wait_ms, 10) / 1000)

        if isinstance(last_error, DomainMediaError):
            raise last_error
        raise DomainInternalError("INTERNAL_SERVER_ERROR", f"TTS 调用失败: {last_error}") from last_error

    async def clone(self, sample: bytes, **options) -> str:
        raise NotImplementedError("CosyVoice clone is planned for subproject D")


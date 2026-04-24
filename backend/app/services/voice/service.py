"""Voice service：并发控制与文本长度校验。"""

from __future__ import annotations

import asyncio

from app.core.exceptions import DomainMediaError
from app.services.voice.provider import VoiceProvider


class VoiceService:
    def __init__(self, provider: VoiceProvider, max_text_length: int = 2000, max_concurrent_tts: int = 10):
        self.provider = provider
        self.max_text_length = max_text_length
        self._semaphore = asyncio.Semaphore(max_concurrent_tts)

    async def synthesize(self, text: str, voice_id: str | None = None) -> bytes:
        if len(text) > self.max_text_length:
            raise DomainMediaError(
                error_code="MEDIA_TTS_TEXT_TOO_LONG",
                message="文本超过 TTS 最大长度",
            )
        try:
            await asyncio.wait_for(self._semaphore.acquire(), timeout=0.1)
        except asyncio.TimeoutError as exc:
            raise DomainMediaError(
                error_code="MEDIA_TTS_QUOTA_EXCEEDED",
                message="TTS 并发达到上限",
            ) from exc
        try:
            return await self.provider.synthesize(text=text, voice_id=voice_id)
        finally:
            self._semaphore.release()


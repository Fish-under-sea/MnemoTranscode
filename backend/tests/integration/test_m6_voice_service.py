from pathlib import Path
import sys

import pytest

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.exceptions import DomainMediaError
from app.services.voice.provider import VoiceProvider
from app.services.voice.service import VoiceService


class DummyVoiceProvider(VoiceProvider):
    async def synthesize(self, text: str, voice_id: str | None = None, **options) -> bytes:
        return text.encode("utf-8")

    async def clone(self, sample: bytes, **options) -> str:
        raise NotImplementedError


@pytest.mark.asyncio
async def test_voice_service_rejects_text_too_long():
    service = VoiceService(provider=DummyVoiceProvider(), max_text_length=5, max_concurrent_tts=1)
    with pytest.raises(DomainMediaError) as exc:
        await service.synthesize("123456")
    assert exc.value.error_code == "MEDIA_TTS_TEXT_TOO_LONG"


@pytest.mark.asyncio
async def test_voice_service_allows_short_text():
    service = VoiceService(provider=DummyVoiceProvider(), max_text_length=10, max_concurrent_tts=1)
    data = await service.synthesize("ok")
    assert data == b"ok"


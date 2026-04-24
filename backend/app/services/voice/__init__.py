"""Voice 服务子包。"""

from app.services.voice.provider import VoiceProvider
from app.services.voice.cosyvoice import CosyVoiceProvider
from app.services.voice.service import VoiceService

__all__ = ["VoiceProvider", "CosyVoiceProvider", "VoiceService"]


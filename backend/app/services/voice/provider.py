"""Voice provider 抽象协议。"""

from __future__ import annotations

from abc import ABC, abstractmethod


class VoiceProvider(ABC):
    @abstractmethod
    async def synthesize(self, text: str, voice_id: str | None = None, **options) -> bytes:
        """文本转语音。"""

    @abstractmethod
    async def clone(self, sample: bytes, **options) -> str:
        """声音克隆，占位由 D 子项目实现。"""


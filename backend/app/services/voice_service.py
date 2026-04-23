"""
语音合成服务

整合 KouriChat 的 TTS 逻辑，支持多种 TTS 引擎
"""

import uuid
from typing import Literal

import httpx

from app.core.config import get_settings

settings = get_settings()


class VoiceService:
    """语音合成服务"""

    def __init__(self):
        self.tts_api_key = settings.tts_api_key
        self.tts_base_url = settings.tts_base_url
        self.tts_model = settings.tts_model

    async def text_to_speech(
        self,
        text: str,
        voice_id: str | None = None,
        engine: Literal["elevenlabs", "cosyvoice", "fish_audio"] = "elevenlabs",
    ) -> bytes:
        """
        文字转语音

        支持多种 TTS 引擎：
        - elevenlabs: ElevenLabs API（商业方案，效果好）
        - cosyvoice: 阿里 CosyVoice（开源，中文支持好）
        - fish_audio: Fish Audio（开源，支持角色音色克隆）
        """
        if engine == "elevenlabs":
            return await self._elevenlabs_tts(text, voice_id)
        elif engine == "cosyvoice":
            return await self._cosyvoice_tts(text, voice_id)
        elif engine == "fish_audio":
            return await self._fish_audio_tts(text, voice_id)
        else:
            raise ValueError(f"不支持的 TTS 引擎: {engine}")

    async def _elevenlabs_tts(self, text: str, voice_id: str | None = None) -> bytes:
        """ElevenLabs TTS"""
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.tts_base_url}/text-to-speech/{voice_id or '21m00Tcm4TlvDq8ikWAM'}",
                headers={
                    "xi-api-key": self.tts_api_key,
                    "Content-Type": "application/json",
                },
                json={
                    "text": text,
                    "model_id": "eleven_monolingual_v1",
                    "voice_settings": {
                        "stability": 0.5,
                        "similarity_boost": 0.75,
                    },
                },
            )
            return response.content

    async def _cosyvoice_tts(self, text: str, voice_id: str | None = None) -> bytes:
        """阿里 CosyVoice TTS（开源）"""
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{settings.cosyvoice_url}/tts",
                json={
                    "text": text,
                    "voice_id": voice_id,
                },
            )
            return response.content

    async def _fish_audio_tts(self, text: str, voice_id: str | None = None) -> bytes:
        """Fish Audio TTS（支持角色克隆）"""
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.fish.audio/tts",
                headers={"Authorization": f"Bearer {self.tts_api_key}"},
                json={
                    "text": text,
                    "reference_id": voice_id,
                },
            )
            return response.content

    async def clone_voice(
        self,
        audio_samples: list[bytes],
        name: str,
        description: str = "",
    ) -> str:
        """
        克隆声音

        返回 voice_id 用于后续 TTS

        注意：不同引擎的克隆流程不同
        """
        if self.tts_base_url and "elevenlabs" in self.tts_base_url:
            return await self._elevenlabs_clone(audio_samples, name)
        elif self.tts_base_url and "fish.audio" in self.tts_base_url:
            return await self._fish_audio_clone(audio_samples, name, description)
        else:
            raise NotImplementedError("当前引擎不支持声音克隆")

    async def _elevenlabs_clone(
        self, audio_samples: list[bytes], name: str
    ) -> str:
        """ElevenLabs 声音克隆"""
        import io
        import multipart

        buffer = io.BytesIO()
        writer = multipart.MultipartWriter(buffer)

        writer.field("name", name)
        writer.field("description", "MTC 记忆银行声音克隆")

        for i, sample in enumerate(audio_samples):
            part = writer.append(
                sample,
                {
                    "Content-Type": "audio/mpeg",
                },
            )

        writer.close()

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                "https://api.elevenlabs.io/v1/voices/add",
                headers={"xi-api-key": self.tts_api_key},
                content=buffer.getvalue(),
            )
            data = response.json()
            return data["voice_id"]

    async def _fish_audio_clone(
        self, audio_samples: list[bytes], name: str, description: str
    ) -> str:
        """Fish Audio 声音克隆"""
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                "https://api.fish.audio/v1/clone",
                headers={"Authorization": f"Bearer {self.tts_api_key}"},
                json={
                    "name": name,
                    "description": description,
                },
                files=[("audio", f"sample_{i}.mp3", sample) for i, sample in enumerate(audio_samples)],
            )
            data = response.json()
            return data["reference_id"]

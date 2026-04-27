"""
AI 核心服务层

整合 KouriChat 的 LLM Service 核心逻辑，支持多渠道对话
"""

import os
from typing import Literal

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import get_settings

settings = get_settings()


class LLMService:
    """LLM 对话服务，封装 OpenAI 兼容 API 调用"""

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str | None = None,
    ):
        self.api_key = api_key or settings.llm_api_key
        self.base_url = base_url or settings.llm_base_url
        self.model = model or settings.llm_model
        self.max_tokens = settings.llm_max_tokens
        self.temperature = settings.llm_temperature

    def _build_messages(
        self,
        message: str,
        system_prompt: str,
        history: list[dict],
    ) -> list[dict]:
        """构建消息列表"""
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.extend(history)
        messages.append({"role": "user", "content": message})
        return messages

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def get_response(
        self,
        message: str,
        system_prompt: str = "",
        history: list[dict] | None = None,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> str:
        """
        调用 LLM 获取回复

        整合了 KouriChat 的核心逻辑：
        - 支持 OpenAI 兼容 API
        - 自动重试机制
        - 思考内容过滤（R1 模型格式）
        """
        history = history or []

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.base_url.rstrip('/')}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model or self.model,
                    "messages": self._build_messages(message, system_prompt, history),
                    "temperature": temperature or self.temperature,
                    "max_tokens": max_tokens or self.max_tokens,
                },
            )

            if response.status_code != 200:
                error_detail = response.text
                raise Exception(f"LLM API 返回错误 {response.status_code}: {error_detail}")

            data = response.json()
            content = data["choices"][0]["message"]["content"]

            # 过滤思考内容（R1 模型格式）
            content = self._filter_thinking_content(content)

            return content

    def _filter_thinking_content(self, content: str) -> str:
        """过滤思考内容（用于 R1 等模型）"""
        think_start = content.find("<think>")
        think_end = content.find("</think>")
        if think_start != -1 and think_end != -1:
            content = content[:think_start] + content[think_end + 9:].strip()
        return content

    async def chat(self, messages: list[dict], **kwargs) -> str:
        """直接传入消息列表进行对话"""
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.base_url.rstrip('/')}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": kwargs.get("model", self.model),
                    "messages": messages,
                    "temperature": kwargs.get("temperature", self.temperature),
                    "max_tokens": kwargs.get("max_tokens", self.max_tokens),
                },
            )
            data = response.json()
            return data["choices"][0]["message"]["content"]

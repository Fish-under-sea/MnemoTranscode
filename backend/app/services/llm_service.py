"""
AI 核心服务层

整合 KouriChat 的 LLM Service 核心逻辑，支持多渠道对话
"""

import json
import re
from typing import Any

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

    def _request_headers(self) -> dict[str, str]:
        """无密钥时跳过 Authorization（兼容本地 Ollama 等）"""
        h = {"Content-Type": "application/json"}
        key = (self.api_key or "").strip()
        if key:
            h["Authorization"] = f"Bearer {key}"
        return h

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
        usage_out: dict | None = None,
    ) -> str:
        """
        调用 LLM 获取回复

        整合了 KouriChat 的核心逻辑：
        - 支持 OpenAI 兼容 API
        - 自动重试机制
        - 思考内容过滤（R1 模型格式）
        """
        history = history or []
        use_model = model or self.model

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.base_url.rstrip('/')}/chat/completions",
                headers=self._request_headers(),
                json={
                    "model": use_model,
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

            if usage_out is not None:
                u = data.get("usage") if isinstance(data.get("usage"), dict) else {}
                usage_out["model"] = data.get("model") or use_model
                usage_out["prompt_tokens"] = u.get("prompt_tokens")
                usage_out["completion_tokens"] = u.get("completion_tokens")
                usage_out["total_tokens"] = u.get("total_tokens")

            return content

    def _filter_thinking_content(self, content: str) -> str:
        """过滤思考内容（用于 R1 等模型）"""
        think_start = content.find("<think>")
        think_end = content.find("</think>")
        if think_start != -1 and think_end != -1:
            content = content[:think_start] + content[think_end + 9:].strip()
        return content

    @staticmethod
    def _parse_json_object(text: str) -> dict:
        raw = text.strip()
        if raw.startswith("```"):
            raw = re.sub(r"^```\w*\s*", "", raw)
            raw = re.sub(r"\s*```\s*$", "", raw)
        return json.loads(raw)

    async def complete(self, prompt: str, **kwargs: Any) -> str:
        """单轮补全（整段提示作为 user 消息）。"""
        return await self.chat([{"role": "user", "content": prompt}], **kwargs)

    async def json_complete(self, prompt: str, usage_out: dict | None = None, **kwargs: Any) -> dict:
        """LLM 只输出 JSON 对象时的解析（用于冲突裁决、结构化抽取）。"""
        temp = kwargs.pop("temperature", 0.2)
        text = await self.complete(
            prompt + "\n只输出一个 JSON 对象，不要 Markdown、不要其它说明文字。",
            temperature=temp,
            usage_out=usage_out,
            **kwargs,
        )
        text = self._filter_thinking_content(text)
        try:
            data = self._parse_json_object(text)
        except json.JSONDecodeError:
            m = re.search(r"\{[\s\S]*\}", text)
            if not m:
                raise
            data = json.loads(m.group(0))
        if not isinstance(data, dict):
            raise ValueError("json_complete 期望对象")
        return data

    async def chat(self, messages: list[dict], **kwargs) -> str:
        """直接传入消息列表进行对话。可传 timeout= 秒数（默认 60），用于长提示或 JSON 抽取。"""
        usage_out = kwargs.pop("usage_out", None)
        timeout_sec = float(kwargs.pop("timeout", 60.0))
        use_model = kwargs.pop("model", self.model)
        temperature = kwargs.pop("temperature", self.temperature)
        max_tokens = kwargs.pop("max_tokens", self.max_tokens)
        async with httpx.AsyncClient(timeout=timeout_sec) as client:
            response = await client.post(
                f"{self.base_url.rstrip('/')}/chat/completions",
                headers=self._request_headers(),
                json={
                    "model": use_model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
            )
            if response.status_code != 200:
                detail = (response.text or "")[:2000]
                raise Exception(f"LLM API 返回错误 {response.status_code}: {detail}")
            data = response.json()
            choices = data.get("choices")
            if not isinstance(choices, list) or len(choices) < 1:
                raise Exception(f"LLM 响应缺少 choices: {str(data)[:800]}")
            msg = choices[0].get("message") if isinstance(choices[0], dict) else None
            content = msg.get("content") if isinstance(msg, dict) else None
            if not isinstance(content, str):
                raise Exception(f"LLM 响应无有效 content: {str(data)[:800]}")
            if usage_out is not None:
                u = data.get("usage") if isinstance(data.get("usage"), dict) else {}
                usage_out["model"] = data.get("model") or use_model
                usage_out["prompt_tokens"] = u.get("prompt_tokens")
                usage_out["completion_tokens"] = u.get("completion_tokens")
                usage_out["total_tokens"] = u.get("total_tokens")
            return content

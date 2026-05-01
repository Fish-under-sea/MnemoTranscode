"""
记忆整理引擎服务

LLM 自动总结、归类、时间线排序
"""

import json
import httpx

from app.core.config import get_settings
from app.schemas.client_llm import ClientLlmOverride

settings = get_settings()


def _openai_compat_headers(api_key: str | None) -> dict[str, str]:
    """无密钥时不带 Authorization"""
    headers: dict[str, str] = {"Content-Type": "application/json"}
    key = (api_key or "").strip()
    if key:
        headers["Authorization"] = f"Bearer {key}"
    return headers


class MemoryOrganizerService:
    """记忆整理引擎"""

    def __init__(self):
        self.api_key = settings.llm_api_key
        self.base_url = settings.llm_base_url

    async def summarize_memory(self, content: str) -> dict:
        """
        总结记忆内容，提取关键信息

        返回摘要、关键词、情感标签、时间线索
        """
        prompt = f"""分析以下记忆内容，提取关键信息：

{content}

请以 JSON 格式返回（只返回 JSON，不要其他文字）：
{{
    "summary": "50字以内的摘要",
    "keywords": ["关键词1", "关键词2", "关键词3"],
    "time_clue": "如果文中提到时间，返回时间线索（如：1990年代、童年时期等）",
    "people": ["涉及的人物"],
    "location": "涉及的地点"
}}"""

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url.rstrip('/')}/chat/completions",
                    headers=_openai_compat_headers(self.api_key),
                    json={
                        "model": settings.llm_model,
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": 300,
                        "temperature": 0.3,
                    },
                )
                result = response.json()
                parsed = result["choices"][0]["message"]["content"]
                return json.loads(parsed)
        except Exception:
            return {"summary": content[:50], "keywords": [], "time_clue": None, "people": [], "location": None}

    async def rebuild_timeline(self, memories: list[dict]) -> list[dict]:
        """
        根据记忆内容重建时间线

        整合了 KouriChat 记忆生成的核心逻辑
        """
        if not memories:
            return []

        prompt = f"""根据以下记忆片段，按时间顺序重建时间线。

记忆片段：
{chr(10).join([f"- {m.get('title', '')}: {m.get('content_text', m.get('content', ''))}" for m in memories])}

请返回 JSON 数组，按时间从早到晚排序：
[{{"title": "时间线标题", "year": 年份, "description": "这段时期发生了什么", "memory_ids": [关联的记忆ID列表]}}]

只返回 JSON，不要其他文字："""

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url.rstrip('/')}/chat/completions",
                    headers=_openai_compat_headers(self.api_key),
                    json={
                        "model": settings.llm_model,
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": 1000,
                        "temperature": 0.5,
                    },
                )
                result = response.json()
                parsed = result["choices"][0]["message"]["content"]
                return json.loads(parsed)
        except Exception:
            return []

    async def generate_story(
        self,
        memories: list[dict],
        member_name: str,
        style: str = "nostalgic",
        llm_override: ClientLlmOverride | None = None,
    ) -> str:
        """
        根据记忆生成故事文本

        用于家族故事书等功能
        """
        memory_texts = "\n".join(
            [
                f"- {m.get('title', '')}: {m.get('content_text', m.get('content', ''))}"
                for m in memories
            ]
        )

        style_desc = {
            "nostalgic": "怀旧温情风格，像翻看老照片一样",
            "literary": "文学风格，优美的散文叙事",
            "simple": "简洁平实的叙述风格",
            "dialogue": "对话为主的故事风格",
        }

        prompt = f"""根据以下关于 {member_name} 的记忆片段，写一篇完整的生命故事。

记忆片段：
{memory_texts}

风格要求：{style_desc.get(style, style_desc['nostalgic'])}

要求：
- 以 {member_name} 的视角叙述
- 融入所有记忆片段
- 有起伏、有情感
- 字数 500-2000 字
- 不要虚构记忆中没有的内容
- 故事要有人情味，不要写成履历表"""

        base = (llm_override.base_url if llm_override else self.base_url).rstrip("/")
        model = llm_override.model if llm_override else settings.llm_model
        ak = llm_override.api_key if llm_override is not None else self.api_key

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{base}/chat/completions",
                headers=_openai_compat_headers(ak),
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 3000,
                    "temperature": 0.7,
                },
            )
            if response.status_code >= 400:
                raise RuntimeError(response.text[:2000])

            result = response.json()
            try:
                return result["choices"][0]["message"]["content"]
            except (KeyError, IndexError) as exc:
                raise RuntimeError(f"上游返回格式异常：{json.dumps(result)[:1200]}") from exc

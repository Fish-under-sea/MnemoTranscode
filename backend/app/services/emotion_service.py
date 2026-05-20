"""
情感识别服务

NLP 情绪标注模块
"""

import httpx
from app.core.config import get_settings
from app.lib.emotion_taxonomy import (
    VALID_EMOTION_VALUES,
    emotion_prompt_choices_line,
    normalize_emotion_label,
)

settings = get_settings()

EMOTION_LABELS = sorted(VALID_EMOTION_VALUES)


class EmotionService:
    """情感识别服务"""

    def __init__(self):
        self.api_key = settings.llm_api_key
        self.base_url = settings.llm_base_url

    async def analyze_emotion(self, text: str) -> str:
        """
        分析文本情感，返回情感标签

        整合了 KouriChat 的情感检测逻辑
        """
        prompt = f"""分析以下文本的情感，用一个最贴切的标签描述：

文本：{text}

可选情感标签（仅返回 value，不要中文）：{emotion_prompt_choices_line()}

只返回一个 value，不要其他文字："""

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url.rstrip('/')}/chat/completions",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    json={
                        "model": settings.llm_model,
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": 20,
                        "temperature": 0.3,
                    },
                )
                result = response.json()
                emotion = result["choices"][0]["message"]["content"].strip().lower()
                normalized = normalize_emotion_label(emotion)
                if normalized:
                    return normalized
                if emotion in EMOTION_LABELS:
                    return emotion
                return "joy_serenity"
        except Exception:
            return "joy_serenity"

    async def analyze_emotions_batch(self, texts: list[str]) -> list[str]:
        """批量分析文本情感"""
        return [await self.analyze_emotion(text) for text in texts]

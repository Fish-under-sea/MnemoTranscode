"""
普卢奇克情绪轮（Plutchik）：8 族 × 3 强度 + 8 复合情绪（dyad）。
存储键为稳定英文 value；展示用中文 label。归一化仅做词典映射，不臆测以免记忆失真。
"""

from __future__ import annotations

from typing import Any, Literal, TypedDict

EmotionFamily = Literal[
    "joy",
    "trust",
    "fear",
    "surprise",
    "sadness",
    "disgust",
    "anger",
    "anticipation",
]

FAMILY_LABEL_ZH: dict[str, str] = {
    "joy": "喜悦",
    "trust": "信任",
    "fear": "恐惧",
    "surprise": "惊讶",
    "sadness": "悲伤",
    "disgust": "厌恶",
    "anger": "愤怒",
    "anticipation": "期待",
}

FAMILY_COLOR: dict[str, str] = {
    "joy": "#EAB308",
    "trust": "#84CC16",
    "fear": "#15803D",
    "surprise": "#38BDF8",
    "sadness": "#2563EB",
    "disgust": "#9333EA",
    "anger": "#DC2626",
    "anticipation": "#EA580C",
}


class EmotionDef(TypedDict):
    value: str
    label: str
    family: EmotionFamily
    tier: Literal["intensity", "dyad"]
    intensity: int  # 1=外圈弱 2=中 3=内圈强；dyad 为 0
    color: str


def _intensity(
    value: str,
    label: str,
    family: EmotionFamily,
    intensity: int,
) -> EmotionDef:
    return {
        "value": value,
        "label": label,
        "family": family,
        "tier": "intensity",
        "intensity": intensity,
        "color": FAMILY_COLOR[family],
    }


def _dyad(value: str, label: str, families: tuple[EmotionFamily, EmotionFamily]) -> EmotionDef:
    c1, c2 = FAMILY_COLOR[families[0]], FAMILY_COLOR[families[1]]
    # 两族主色混合，供关系网结点着色
    return {
        "value": value,
        "label": label,
        "family": families[0],
        "tier": "dyad",
        "intensity": 0,
        "color": c1 if c1 == c2 else f"color-mix(in srgb, {c1} 50%, {c2})",
    }


PLUTCHIK_EMOTIONS: list[EmotionDef] = [
    # 喜悦
    _intensity("joy_serenity", "平静", "joy", 1),
    _intensity("joy_joy", "快乐", "joy", 2),
    _intensity("joy_ecstasy", "狂喜", "joy", 3),
    # 信任
    _intensity("trust_acceptance", "接受", "trust", 1),
    _intensity("trust_trust", "信任", "trust", 2),
    _intensity("trust_admiration", "崇敬", "trust", 3),
    # 恐惧
    _intensity("fear_apprehension", "担心", "fear", 1),
    _intensity("fear_fear", "恐惧", "fear", 2),
    _intensity("fear_terror", "惊悚", "fear", 3),
    # 惊讶
    _intensity("surprise_distraction", "不解", "surprise", 1),
    _intensity("surprise_surprise", "惊讶", "surprise", 2),
    _intensity("surprise_amazement", "惊诧", "surprise", 3),
    # 悲伤
    _intensity("sadness_pensiveness", "伤感", "sadness", 1),
    _intensity("sadness_sadness", "悲伤", "sadness", 2),
    _intensity("sadness_grief", "悲痛", "sadness", 3),
    # 厌恶
    _intensity("disgust_boredom", "厌倦", "disgust", 1),
    _intensity("disgust_disgust", "厌恶", "disgust", 2),
    _intensity("disgust_loathing", "憎恨", "disgust", 3),
    # 愤怒
    _intensity("anger_annoyance", "不耐烦", "anger", 1),
    _intensity("anger_anger", "生气", "anger", 2),
    _intensity("anger_rage", "暴怒", "anger", 3),
    # 期待
    _intensity("anticipation_interest", "关心", "anticipation", 1),
    _intensity("anticipation_anticipation", "期待", "anticipation", 2),
    _intensity("anticipation_vigilance", "警惕", "anticipation", 3),
    # 复合情绪（dyad）
    _dyad("dyad_love", "友爱", ("joy", "trust")),
    _dyad("dyad_submission", "屈服", ("trust", "fear")),
    _dyad("dyad_awe", "敬畏", ("fear", "surprise")),
    _dyad("dyad_disapproval", "反对", ("surprise", "sadness")),
    _dyad("dyad_remorse", "懊悔", ("sadness", "disgust")),
    _dyad("dyad_contempt", "鄙夷", ("disgust", "anger")),
    _dyad("dyad_aggression", "挑衅", ("anger", "anticipation")),
    _dyad("dyad_optimism", "乐观", ("anticipation", "joy")),
]

EMOTION_BY_VALUE: dict[str, EmotionDef] = {e["value"]: e for e in PLUTCHIK_EMOTIONS}
VALID_EMOTION_VALUES: frozenset[str] = frozenset(EMOTION_BY_VALUE.keys())

# 旧版 10 标签 + 导入/对话常用中文 → 轮上最近项
LEGACY_AND_ALIAS: dict[str, str] = {
    # legacy english
    "joy": "joy_joy",
    "love": "dyad_love",
    "anger": "anger_anger",
    "sadness": "sadness_sadness",
    "fear": "fear_fear",
    "surprise": "surprise_surprise",
    "nostalgia": "sadness_pensiveness",
    "gratitude": "trust_admiration",
    "regret": "dyad_remorse",
    "peaceful": "joy_serenity",
    # 导入/对话 LLM 常用中文
    "温暖": "dyad_love",
    "感伤": "sadness_sadness",
    "快乐": "joy_joy",
    "平静": "joy_serenity",
    "自豪": "trust_admiration",
    "感激": "trust_admiration",
    "感恩": "trust_admiration",
    "怀念": "sadness_pensiveness",
    "愧疚": "dyad_remorse",
    "安心": "trust_acceptance",
    "坚韧": "anticipation_vigilance",
    "爱": "dyad_love",
    "喜悦": "joy_joy",
    "愤怒": "anger_anger",
    "悲伤": "sadness_sadness",
    "恐惧": "fear_fear",
    "惊讶": "surprise_surprise",
    "厌恶": "disgust_disgust",
    "期待": "anticipation_anticipation",
    "遗憾": "dyad_remorse",
}

# 中文标准名 → value（与 label 一致）
for _e in PLUTCHIK_EMOTIONS:
    LEGACY_AND_ALIAS[_e["label"]] = _e["value"]
    LEGACY_AND_ALIAS[_e["value"]] = _e["value"]


def normalize_emotion_label(raw: str | None) -> str | None:
    """将 LLM/用户输入映射为轮上 value；无法可靠映射时返回 None（不强行贴标签）。"""
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    key = s.lower().replace(" ", "_").replace("-", "_")
    if key in VALID_EMOTION_VALUES:
        return key
    if key in LEGACY_AND_ALIAS:
        return LEGACY_AND_ALIAS[key]
    if s in LEGACY_AND_ALIAS:
        return LEGACY_AND_ALIAS[s]
    return None


def emotion_display_label(value_or_raw: str | None) -> str | None:
    """展示用中文；未知键则原样返回以便旧数据可读。"""
    if not value_or_raw or not str(value_or_raw).strip():
        return None
    s = str(value_or_raw).strip()
    norm = normalize_emotion_label(s)
    if norm and norm in EMOTION_BY_VALUE:
        return EMOTION_BY_VALUE[norm]["label"]
    if s in EMOTION_BY_VALUE:
        return EMOTION_BY_VALUE[s]["label"]
    return s


def emotion_color(value_or_raw: str | None) -> str | None:
    norm = normalize_emotion_label(value_or_raw) if value_or_raw else None
    if norm and norm in EMOTION_BY_VALUE:
        c = EMOTION_BY_VALUE[norm]["color"]
        if c.startswith("color-mix"):
            return FAMILY_COLOR.get(EMOTION_BY_VALUE[norm]["family"], "#94a3b8")
        return c
    return None


def emotion_prompt_choices_line() -> str:
    """供 LLM 提示：value=中文，仅选其一或空。"""
    parts = [f'{e["value"]}={e["label"]}' for e in PLUTCHIK_EMOTIONS]
    return "、".join(parts)


def emotion_prompt_instruction() -> str:
    return (
        f"- emotion_label 必须从下列普卢奇克情绪轮标签中选**一个** value（无把握则填空字符串）：\n"
        f"  {emotion_prompt_choices_line()}"
    )

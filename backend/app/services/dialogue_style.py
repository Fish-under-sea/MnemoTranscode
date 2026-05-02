"""对话节奏：从历史消息与记忆中提取用户发送习惯（文字 / 表情包 / 语音暗示），写入系统提示。"""

from __future__ import annotations

import re
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.dialogue import DialogueChatMessage
from app.models.memory import Memory

SEGMENT_DELIM = "|||"

_VOICE_HINT_RE = re.compile(
    r"语音|視頻通话|视频通话|电话|講電話|打电话|電話|语音消息|語音留言|發語音|发语音",
)


@dataclass
class DialogueStyleStats:
    """用于 TTS 选段与用户节奏提示的统计数据。"""

    window_user_turns: int
    sticker_turns: int
    avg_user_chars: float
    memory_voice_hints: float

    @property
    def sticker_ratio(self) -> float:
        if self.window_user_turns <= 0:
            return 0.0
        return max(0.0, min(1.0, self.sticker_turns / float(self.window_user_turns)))

    @property
    def voice_hint_ratio(self) -> float:
        return max(0.0, min(1.0, self.memory_voice_hints))


async def load_dialogue_style_for_prompt(
    db: AsyncSession,
    *,
    user_id: int,
    member_id: int,
    archive_id: int,
) -> tuple[str, DialogueStyleStats]:
    """返回 (写入 system 的补充段落, 统计数据)。"""
    stmt = (
        select(DialogueChatMessage)
        .where(
            DialogueChatMessage.user_id == user_id,
            DialogueChatMessage.member_id == member_id,
            DialogueChatMessage.archive_id == archive_id,
            DialogueChatMessage.role == "user",
        )
        .order_by(DialogueChatMessage.id.desc())
        .limit(80)
    )
    r = await db.execute(stmt)
    rows = list(r.scalars().all())

    n = len(rows)
    sticker_n = 0
    chars: list[int] = []
    for m in rows:
        ex = m.extras if isinstance(getattr(m, "extras", None), dict) else {}
        stickers = ex.get("stickers") if isinstance(ex, dict) else None
        if isinstance(stickers, list) and len(stickers) > 0:
            sticker_n += 1
        c = len((m.content or "").strip())
        if c > 0:
            chars.append(c)
    avg_c = sum(chars) / len(chars) if chars else 0.0

    mem_stmt = (
        select(Memory.content_text)
        .where(Memory.member_id == member_id)
        .order_by(Memory.updated_at.desc())
        .limit(24)
    )
    mr = await db.execute(mem_stmt)
    mem_texts = list(mr.scalars().all())
    hint_hits = 0
    scanned = 0
    for t in mem_texts:
        s = str(t or "")
        if len(s) < 4:
            continue
        scanned += 1
        if _VOICE_HINT_RE.search(s):
            hint_hits += 1

    hints_ratio = hint_hits / float(scanned) if scanned > 0 else 0.0

    stats = DialogueStyleStats(
        window_user_turns=n,
        sticker_turns=sticker_n,
        avg_user_chars=avg_c,
        memory_voice_hints=hints_ratio,
    )

    sticker_pct = int(round(stats.sticker_ratio * 100))
    lines = [
        "## 与用户对话习惯相关的参考（来自近期聊天记录与你的记忆条目，请勿机械复述统计数字）",
        f"- 近期用户发送的消息中约 **{sticker_pct}%** 含表情包线索（JSON extras 中带 stickers）。",
        f"- 用户纯文字消息平均长度约 **{avg_c:.0f}** 字（仅作语气节奏参考）。",
    ]
    if scanned > 0:
        vpct = int(round(stats.voice_hint_ratio * 100))
        lines.append(
            f"- 记忆摘录中约有 **{vpct}%** 出现「语音 / 通话」等措辞，可作「偏口语」权重的微弱参考。"
        )
    lines.append(
        "- 请以**多轮短气泡**模拟真实聊天节奏；不要一次性抛出过长独白。"
    )

    block = "\n".join(lines)
    return block, stats


def coerce_reply_segments(raw: str) -> str:
    """
    将模型输出规整为 SEGMENT_DELIM 连接的多段正文。
    若模型忘记分隔符：按空行切段，过少则再在句号处切。
    """
    s = raw.strip()
    if not s:
        return s
    if SEGMENT_DELIM in s:
        parts = [p.strip() for p in s.split(SEGMENT_DELIM)]
        parts = [p for p in parts if p]
        return SEGMENT_DELIM.join(parts)

    chunks = [c.strip() for c in re.split(r"\n{2,}", s) if c.strip()]
    if len(chunks) >= 2:
        return SEGMENT_DELIM.join(chunks)

    if len(s) <= 260:
        return s

    out: list[str] = []
    buf = ""
    for para in re.split(r"(?<=[。！？!?])\s*", s):
        para = para.strip()
        if not para:
            continue
        if not buf:
            buf = para
            continue
        if len(buf) + len(para) < 120:
            buf = f"{buf}{para}"
        else:
            out.append(buf.strip())
            buf = para
    if buf:
        out.append(buf.strip())
    if len(out) >= 2:
        return SEGMENT_DELIM.join(out)
    mid = len(s) // 2
    sp = mid
    return SEGMENT_DELIM.join([s[:sp].strip(), s[sp:].strip()])


def split_segments(coalesced: str) -> list[str]:
    return [p.strip() for p in coalesced.split(SEGMENT_DELIM) if p.strip()]


def compute_tts_segment_indices(segments: list[str], stats: DialogueStyleStats) -> list[int]:
    """按风格统计决定朗读哪些分段（无克隆时使用 VoiceDesign 路线由前端请求 /tts）。"""
    if not segments:
        return []

    weight = 0.16 + 0.38 * stats.sticker_ratio + 0.28 * stats.voice_hint_ratio
    weight = max(0.1, min(0.52, weight))

    picked: list[int] = []
    for i, seg in enumerate(segments):
        t = seg.strip()
        lt = len(t)
        if lt < 14 or lt > 420:
            continue
        if t.startswith("*") and "*" in t[1:] and "\n" not in t:
            continue
        h = (((stats.window_user_turns + 1) * 7919 + (i + 1) * 104729) % 10000) / 10000.0
        if h < weight:
            picked.append(i)
    if not picked:
        t0 = segments[0].strip()
        if 14 <= len(t0) <= 420:
            picked = [0]
    seen = set()
    out = []
    for i in sorted(picked):
        if i not in seen:
            seen.add(i)
            out.append(i)
    return out[: min(8, len(segments))]


def segment_format_rules() -> str:
    """供拼进系统提示的统一格式说明。"""
    return f"""### 分段输出格式（必须遵守）
- 每一小段就像手机聊天里的**单独一条气泡**，内容要简短、可分多次发送。
- 段与段之间只用**独占一行**的 `{SEGMENT_DELIM}` 分隔（三个竖线符号），不要使用其它占位符。
- 单段内尽量不超过 180 个中文字符；动作描写置于独立小段时可用 *星号包围*。
- 禁止把整个长回复连成一段不写分隔符；若情绪需要展开，也通过多段自然停顿完成。"""


def voice_design_instructions_from_member(member) -> str:
    """尚无 voice_sample（克隆音频）时的音色设计口令（中文短语）。"""
    parts = [
        f'角色昵称：{(getattr(member, "name", None) or "").strip() or "对方"}。',
    ]
    rel = getattr(member, "relationship_type", None)
    if rel:
        parts.append(f'关系：{str(rel).strip()}。')
    bio = getattr(member, "bio", None)
    if bio and str(bio).strip():
        b = str(bio).strip().replace("\n", " ")
        parts.append(f'人物简述：{b[:380]}')
    parts.append("语气：温婉、可信、略带呼吸感的日常对话女声，语速中等，不过分戏剧化。")
    return " ".join(parts)

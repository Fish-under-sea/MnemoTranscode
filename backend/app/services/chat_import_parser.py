"""
微信 / 聊天工具导出的纯文本解析为记忆草稿。

支持常见形态：「日期时间 + 昵称 + 正文」多段，或「昵称」单独一行后接正文。
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Literal

# 2023-06-01 15:00 或 2023/6/1 下午3:00 等（宽松）
_RE_TIME_HEAD = re.compile(
    r"^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[\s，,]*(上午|下午|中午|晚上)?[\s，,]*(\d{1,2}):(\d{1,2})",
)
_RE_SIMPLE_DATE = re.compile(r"^(\d{4})[-/](\d{1,2})[-/](\d{1,2})")
# 单独一行像昵称：不太长、无句号、少空格（启发式）
_RE_NAME_LINE = re.compile(r"^[\w\u4e00-\u9fff·—\-—\s]{1,32}$")


@dataclass
class ChatMemoryDraft:
    title: str
    content_text: str
    occurred_at: datetime | None
    speaker_hint: str | None  # 导入时原文侧说话者，写入 content 前缀可选


def _parse_ts(y: str, mo: str, d: str, ap: str | None, hh: str, mm: str) -> datetime | None:
    try:
        h = int(hh)
        m = int(mm)
        if ap in ("下午", "晚上") and h < 12:
            h += 12
        if ap == "中午":
            h = 12 if h <= 6 else h
        return datetime(int(y), int(mo), int(d), h, m)
    except (ValueError, TypeError):
        return None


def _clean_lines(raw: str) -> list[str]:
    text = raw.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not text:
        return []
    lines = [ln.rstrip() for ln in text.split("\n")]
    out: list[str] = []
    for ln in lines:
        stripped = ln.strip()
        if stripped == "" and out and out[-1] != "":
            out.append("")
        elif stripped:
            out.append(stripped)
    return out


def parse_wechat_export(raw: str) -> list[ChatMemoryDraft]:
    """解析微信 PC/手机导出的聊天 txt（启发式）。"""
    lines = _clean_lines(raw)
    if not lines:
        return []

    drafts: list[ChatMemoryDraft] = []
    i = 0
    pending_name: str | None = None
    pending_ts: datetime | None = None
    buf: list[str] = []

    def flush() -> None:
        nonlocal buf, pending_name, pending_ts
        if not buf:
            return
        body = "\n".join(buf).strip()
        buf = []
        if not body:
            return
        title_src = pending_name or "聊天记录"
        title = (f"{title_src} · " + body[:24]).strip(" ·")[:200]
        prefix = ""
        if pending_name:
            prefix = f"「{pending_name}」\n"
        drafts.append(
            ChatMemoryDraft(
                title=title,
                content_text=(prefix + body)[:20000],
                occurred_at=pending_ts,
                speaker_hint=pending_name,
            )
        )
        pending_name = None
        pending_ts = None

    while i < len(lines):
        line = lines[i]
        if line == "":
            flush()
            i += 1
            continue

        m = _RE_TIME_HEAD.match(line)
        if m:
            flush()
            pending_ts = _parse_ts(m.group(1), m.group(2), m.group(3), m.group(4), m.group(5), m.group(6))
            rest = line[m.end() :].strip()
            if rest and _RE_NAME_LINE.match(rest.split()[0] if rest else ""):
                pending_name = rest.split()[0]
                rest = rest[len(pending_name) :].strip()
            if rest:
                buf.append(rest)
            i += 1
            continue

        m2 = _RE_SIMPLE_DATE.match(line)
        if m2 and len(line) < 48:
            flush()
            try:
                pending_ts = datetime(int(m2.group(1)), int(m2.group(2)), int(m2.group(3)))
            except ValueError:
                pending_ts = None
            tail = line[m2.end() :].strip()
            if tail:
                buf.append(tail)
            i += 1
            continue

        if _RE_NAME_LINE.match(line) and len(line) <= 20 and i + 1 < len(lines) and lines[i + 1] != "":
            flush()
            pending_name = line
            i += 1
            continue

        buf.append(line)
        i += 1

    flush()
    return drafts


def parse_plain_segments(raw: str, *, separator: Literal["blankline", "none"] = "blankline") -> list[ChatMemoryDraft]:
    """普通长文：按空行分段，每段一条记忆。"""
    if separator == "none":
        t = raw.strip()
        if not t:
            return []
        return [ChatMemoryDraft(title=t[:80], content_text=t[:20000], occurred_at=None, speaker_hint=None)]

    parts = re.split(r"\n\s*\n+", raw.strip())
    out: list[ChatMemoryDraft] = []
    for p in parts:
        p = p.strip()
        if not p:
            continue
        title = p.split("\n", 1)[0].strip()[:200]
        out.append(ChatMemoryDraft(title=title or "摘录", content_text=p[:20000], occurred_at=None, speaker_hint=None))
    return out


def parse_chat_import(raw: str, source: str = "auto") -> list[ChatMemoryDraft]:
    """
    source: wechat | plain | auto
    auto：若行内多处出现日期+时间模式则用 wechat，否则 plain 空行分段
    """
    raw = raw.strip()
    if not raw:
        return []
    if source == "plain":
        return parse_plain_segments(raw)
    if source == "wechat":
        return parse_wechat_export(raw)

    # auto
    date_hits = len(_RE_TIME_HEAD.findall(raw)) + len(_RE_SIMPLE_DATE.findall(raw))
    if date_hits >= 2:
        return parse_wechat_export(raw)
    return parse_plain_segments(raw)

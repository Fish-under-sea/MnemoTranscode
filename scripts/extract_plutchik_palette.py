"""从参考图瓣轴中心线采样各色（避免跨瓣污染）"""
from __future__ import annotations

import json
import math
import statistics
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
REF = Path(
    r"C:\Users\Fish\.cursor\projects\d-Fish-code-MTC-MTC-Cursor\assets"
    r"\c__Users_Fish_AppData_Roaming_Cursor_User_workspaceStorage_fd9e19e293e6d5b4cb81b242bec39ab4_images_image-b333753e-991e-4b47-af0c-f596622ea467.png"
)
OUT_TS = ROOT / "frontend" / "src" / "lib" / "plutchikWheelPalette.ts"

CX, CY = 480.0, 416.0
R_TIP = 468.0


def spoke_mid(i: int) -> float:
    return -81 + 90 + i * 45


def rad(mid: float) -> float:
    return math.radians(mid - 90)


def is_white(c: tuple[int, int, int]) -> bool:
    return min(c) > 245 or (c[0] + c[1] + c[2]) > 740


def median_color(samples: list[tuple[int, int, int]]) -> str:
    if len(samples) < 5:
        return "#cccccc"
    med = tuple(int(statistics.median([c[i] for c in samples])) for i in range(3))
    return f"#{med[0]:02x}{med[1]:02x}{med[2]:02x}"


def line_samples(px, mid: float, r0: float, r1: float, step: float = 2.5) -> list[tuple[int, int, int]]:
    out: list[tuple[int, int, int]] = []
    a = rad(mid)
    r = r0
    while r < r1:
        x = int(CX + r * math.cos(a))
        y = int(CY + r * math.sin(a))
        c = px[x, y]
        if not is_white(c):
            out.append(c)
        r += step
    return out


def main() -> None:
    im = Image.open(REF).convert("RGB")
    px = im.load()

    keys = [
        ["joy_ecstasy", "joy_joy", "joy_serenity"],
        ["trust_admiration", "trust_trust", "trust_acceptance"],
        ["fear_terror", "fear_fear", "fear_apprehension"],
        ["surprise_amazement", "surprise_surprise", "surprise_distraction"],
        ["sadness_grief", "sadness_sadness", "sadness_pensiveness"],
        ["disgust_loathing", "disgust_disgust", "disgust_boredom"],
        ["anger_rage", "anger_anger", "anger_annoyance"],
        ["anticipation_vigilance", "anticipation_anticipation", "anticipation_interest"],
    ]
    dyads = [
        "dyad_love",
        "dyad_submission",
        "dyad_awe",
        "dyad_disapproval",
        "dyad_remorse",
        "dyad_contempt",
        "dyad_aggression",
        "dyad_optimism",
    ]

    rings = [(38, 100), (112, 195), (206, 282)]

    colors: dict[str, str] = {}
    for i, vals in enumerate(keys):
        mid = spoke_mid(i)
        for j, key in enumerate(vals):
            r0, r1 = rings[j]
            colors[key] = median_color(line_samples(px, mid, r0, r1))

    for i, key in enumerate(dyads):
        bisect = spoke_mid(i) + 22.5
        colors[key] = median_color(line_samples(px, bisect, 300, 430))

    OUT_TS.write_text(
        "/** 自参考图瓣轴采样 — 重生成: python scripts/extract_plutchik_palette.py */\n"
        + "export const PLUTCHIK_WHEEL_SEGMENT_FILL: Record<string, string> = "
        + json.dumps(colors, indent=2, ensure_ascii=False).replace('"', "'").replace("'", "'", 1)
        + "\n",
        encoding="utf-8",
    )
    # fix json quotes for TS
    body = ",\n".join(f"  '{k}': '{v}'" for k, v in colors.items())
    OUT_TS.write_text(
        "/** 自参考图瓣轴采样 — 重生成: python scripts/extract_plutchik_palette.py */\n"
        f"export const PLUTCHIK_WHEEL_SEGMENT_FILL: Record<string, string> = {{\n{body},\n}}\n",
        encoding="utf-8",
    )
    print(json.dumps(colors, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()

"""从裁剪后的参考图采样 32 段代表色，输出 TS 片段"""
from __future__ import annotations

import json
import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
IMG = ROOT / "frontend" / "src" / "assets" / "plutchik-wheel-classic.png"
SPEC = json.loads((ROOT / "frontend" / "src" / "lib" / "plutchikWheelClassicSpec.json").read_text())

CX, CY = SPEC["center"]
JOY = SPEC["joySpokeDeg"]

FAMILIES = [
    "joy",
    "trust",
    "fear",
    "surprise",
    "sadness",
    "disgust",
    "anger",
    "anticipation",
]
DYADS = [
    "dyad_love",
    "dyad_submission",
    "dyad_awe",
    "dyad_disapproval",
    "dyad_remorse",
    "dyad_contempt",
    "dyad_aggression",
    "dyad_optimism",
]
INTENSITY_KEYS = ["inner", "mid", "outer"]  # maps to intensity 3,2,1


def spoke_mid(i: int) -> float:
    return JOY + 90 + i * 45


def rgb_hex(c: tuple[int, int, int]) -> str:
    return f"#{c[0]:02x}{c[1]:02x}{c[2]:02x}"


def sample_ring(px, mid: float, r_frac: float, radius: float) -> str:
    rad = math.radians(mid - 90)
    r = radius * r_frac
    x = int(CX + r * math.cos(rad))
    y = int(CY + r * math.sin(rad))
    return rgb_hex(px[x, y])


def main() -> None:
    im = Image.open(IMG).convert("RGB")
    px = im.load()
    radius = SPEC["rTip"]
    out: dict[str, str] = {}

    fracs = {"inner": 0.14, "mid": 0.36, "outer": 0.52}
    for i, fam in enumerate(FAMILIES):
        mid = spoke_mid(i)
        for ring, key in enumerate(INTENSITY_KEYS):
            val = f"{fam}_{'ecstasy' if ring == 0 else 'x'}"  # placeholder
            out_key = None
        # use actual value keys from order
        keys = [
            ("joy", ["joy_ecstasy", "joy_joy", "joy_serenity"]),
            ("trust", ["trust_admiration", "trust_trust", "trust_acceptance"]),
            ("fear", ["fear_terror", "fear_fear", "fear_apprehension"]),
            ("surprise", ["surprise_amazement", "surprise_surprise", "surprise_distraction"]),
            ("sadness", ["sadness_grief", "sadness_sadness", "sadness_pensiveness"]),
            ("disgust", ["disgust_loathing", "disgust_disgust", "disgust_boredom"]),
            ("anger", ["anger_rage", "anger_anger", "anger_annoyance"]),
            ("anticipation", ["anticipation_vigilance", "anticipation_anticipation", "anticipation_interest"]),
        ]
    colors: dict[str, str] = {}
    key_map = [
        ("joy", ["joy_ecstasy", "joy_joy", "joy_serenity"]),
        ("trust", ["trust_admiration", "trust_trust", "trust_acceptance"]),
        ("fear", ["fear_terror", "fear_fear", "fear_apprehension"]),
        ("surprise", ["surprise_amazement", "surprise_surprise", "surprise_distraction"]),
        ("sadness", ["sadness_grief", "sadness_sadness", "sadness_pensiveness"]),
        ("disgust", ["disgust_loathing", "disgust_disgust", "disgust_boredom"]),
        ("anger", ["anger_rage", "anger_anger", "anger_annoyance"]),
        ("anticipation", ["anticipation_vigilance", "anticipation_anticipation", "anticipation_interest"]),
    ]
    for i, (fam, vals) in enumerate(key_map):
        mid = spoke_mid(i)
        for j, v in enumerate(vals):
            frac = [0.14, 0.36, 0.52][j]
            colors[v] = sample_ring(px, mid, frac, radius)

    for i, d in enumerate(DYADS):
        bisect = spoke_mid(i) + 22.5
        colors[d] = sample_ring(px, bisect, 0.82, radius)

    print("export const WHEEL_SEGMENT_COLOR: Record<string, string> = {")
    for k, v in colors.items():
        print(f"  '{k}': '{v}',")
    print("}")


if __name__ == "__main__":
    main()

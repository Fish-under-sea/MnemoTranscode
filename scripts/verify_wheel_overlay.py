"""生成路径叠加预览图（开发自检）"""
from __future__ import annotations

import json
import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
IMG = ROOT / "frontend" / "src" / "assets" / "plutchik-wheel-classic.png"
SPEC = json.loads((ROOT / "frontend" / "src" / "lib" / "plutchikWheelClassicSpec.json").read_text())
OUT = ROOT / "frontend" / "src" / "assets" / "_wheel-overlay-debug.png"

CX, CY = SPEC["center"]
JOY = SPEC["joySpokeDeg"]
S = SPEC


def polar(r: float, deg: float) -> tuple[float, float]:
    rad = math.radians(deg - 90)
    return CX + r * math.cos(rad), CY + r * math.sin(rad)


def spoke_mid(i: int) -> float:
    return JOY + 90 + i * 45


def polygon(draw: ImageDraw.ImageDraw, pts: list[tuple[float, float]], outline: str) -> None:
    draw.polygon(pts, outline=outline)


def main() -> None:
    im = Image.open(IMG).convert("RGBA")
    overlay = Image.new("RGBA", im.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")

    r_mid_in = S["r1"] + S["ringSlit"]
    r_out_in = S["r2"] + S["ringSlit"]

    for i in range(8):
        mid = spoke_mid(i)
        gap = S["petalGapDeg"] / 2
        for half, r_in, r_out in [
            (S["innerHalf"], S["rHole"], S["r1"]),
            (S["midHalf"], r_mid_in, S["r2"]),
            (S["outerHalf"], r_out_in, S["r3"]),
        ]:
            a0, a1 = mid - half + gap, mid + half - gap
            pts = [
                polar(r_out, a0),
                polar(r_out, a1),
                polar(r_in, a1),
                polar(r_in, a0),
            ]
            draw.line(pts + [pts[0]], fill=(255, 0, 0, 180), width=2)

        bisect = mid + 22.5
        tip = polar(S["rTip"], bisect)
        left = polar(S["r3"] - 2, mid + S["outerHalf"] + S["petalGapDeg"] * 0.55)
        right = polar(S["r3"] - 2, spoke_mid(i + 1) - S["outerHalf"] - S["petalGapDeg"] * 0.55)
        draw.polygon([tip, left, right], outline=(0, 120, 255, 200))

    Image.alpha_composite(im, overlay).save(OUT)
    print("wrote", OUT)


if __name__ == "__main__":
    main()

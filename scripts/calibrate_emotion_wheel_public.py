"""校准 public/emotion-wheel.png 圆心与环半径"""
from __future__ import annotations

import json
import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
IMG = ROOT / "frontend" / "public" / "emotion-wheel.png"
OUT = ROOT / "frontend" / "src" / "lib" / "plutchikWheelClassicSpec.json"


def main() -> None:
    im = Image.open(IMG).convert("RGB")
    w, h = im.size
    px = im.load()
    minx, miny, maxx, maxy = w, h, 0, 0
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if r > 248 and g > 248 and b > 248:
                continue
            minx, maxx = min(minx, x), max(maxx, x)
            miny, maxy = min(miny, y), max(maxy, y)
    cx = (minx + maxx) / 2
    cy = (miny + maxy) / 2
    radius = min(maxx - minx, maxy - miny) / 2

    # 喜悦瓣轴扫描
    joy = -90
    trans = []
    prev = True
    rad = math.radians(joy)
    for r in range(5, int(radius)):
        x = int(cx + r * math.cos(rad))
        y = int(cy + r * math.sin(rad))
        white = px[x, y][0] > 250 and px[x, y][1] > 250 and px[x, y][2] > 250
        if white != prev:
            trans.append(r)
            prev = white

    scale = 500 / max(w, h)
    spec = {
        "viewSize": 500,
        "center": [round(cx * scale, 2), round(cy * scale, 2)],
        "rHole": round(32 * scale),
        "r1": round(107 * scale / (radius / 468) if radius else 57),
        "r2": round(200 * scale / (radius / 468) if radius else 106),
        "r3": round(291 * scale / (radius / 468) if radius else 155),
        "rTip": round(452 * scale / (radius / 468) if radius else 240),
        "ringSlit": 2.5,
        "petalGapDeg": 2.2,
        "innerHalf": 5.6,
        "midHalf": 10.2,
        "outerHalf": 14.2,
        "outerBulge": 1.035,
        "imageSrc": "/emotion-wheel.png",
        "imageNatural": [w, h],
    }
  # simpler: proportional from radius
    r_ratio = radius / 468
    spec = {
        "viewSize": 500,
        "center": [round(500 * cx / w, 2), round(500 * cy / h, 2)],
        "rHole": round(32 * 500 / w * (468 / radius)),
        "r1": round(107 * 500 / w * (468 / radius)),
        "r2": round(200 * 500 / w * (468 / radius)),
        "r3": round(291 * 500 / w * (468 / radius)),
        "rTip": round(452 * 500 / w * (468 / radius)),
        "ringSlit": 2.5,
        "petalGapDeg": 2.2,
        "innerHalf": 5.6,
        "midHalf": 10.2,
        "outerHalf": 14.2,
        "outerBulge": 1.035,
        "imageSrc": "/emotion-wheel.png",
        "imageNatural": [w, h],
    }
    OUT.write_text(json.dumps(spec, indent=2) + "\n", encoding="utf-8")
    print("bbox", minx, miny, maxx, maxy, "center", cx, cy, "R", radius)
    print("transitions", trans[:12])
    print(json.dumps(spec, indent=2))


if __name__ == "__main__":
    main()

"""从参考图采样各环颜色与几何中心（一次性脚本）"""
from __future__ import annotations

import json
import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
REF = (
    Path(
        r"C:\Users\Fish\.cursor\projects\d-Fish-code-MTC-MTC-Cursor\assets"
        r"\c__Users_Fish_AppData_Roaming_Cursor_User_workspaceStorage_fd9e19e293e6d5b4cb81b242bec39ab4_images_image-b333753e-991e-4b47-af0c-f596622ea467.png"
    )
    if Path(
        r"C:\Users\Fish\.cursor\projects\d-Fish-code-MTC-MTC-Cursor\assets\c__Users_Fish_AppData_Roaming_Cursor_User_workspaceStorage_fd9e19e293e6d5b4cb81b242bec39ab4_images_image-b333753e-991e-4b47-af0c-f596622ea467.png"
    ).exists()
    else ROOT / "frontend" / "src" / "assets" / "plutchik-wheel-classic.png"
)

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


def rgb_hex(c: tuple[int, int, int]) -> str:
    return f"#{c[0]:02x}{c[1]:02x}{c[2]:02x}"


def main() -> None:
    im = Image.open(REF).convert("RGB")
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

    out: dict = {
        "size": [w, h],
        "bbox": [minx, miny, maxx, maxy],
        "center": [cx, cy],
        "radius": radius,
        "petals": {},
        "dyads": {},
    }

    rings = [("inner", 0.17), ("mid", 0.40), ("outer", 0.58)]
    for i, fam in enumerate(FAMILIES):
        mid = -90 + i * 45
        out["petals"][fam] = {}
        for name, frac in rings:
            r = radius * frac
            rad = math.radians(mid)
            x = int(cx + r * math.cos(rad))
            y = int(cy + r * math.sin(rad))
            out["petals"][fam][name] = rgb_hex(px[x, y])

        bisect = mid + 22.5
        r = radius * 0.86
        rad = math.radians(bisect)
        x = int(cx + r * math.cos(rad))
        y = int(cy + r * math.sin(rad))
        out["dyads"][fam] = rgb_hex(px[x, y])

    print(json.dumps(out, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()

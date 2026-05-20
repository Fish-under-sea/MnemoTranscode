"""裁剪参考图并导出校准 JSON（像素级复刻用）"""
from __future__ import annotations

import json
import math
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
REF = Path(
    r"C:\Users\Fish\.cursor\projects\d-Fish-code-MTC-MTC-Cursor\assets"
    r"\c__Users_Fish_AppData_Roaming_Cursor_User_workspaceStorage_fd9e19e293e6d5b4cb81b242bec39ab4_images_image-b333753e-991e-4b47-af0c-f596622ea467.png"
)
OUT_IMG = ROOT / "frontend" / "src" / "assets" / "plutchik-wheel-classic.png"
OUT_JSON = ROOT / "frontend" / "src" / "lib" / "plutchikWheelClassicSpec.json"

# 参考图实测：喜悦瓣轴约 -81°（非 -90°），圆心略偏上
CX_SRC, CY_SRC = 480.0, 416.0
JOY_SPOKE_DEG = -81.0
R_OUT = 468
PAD = 4


def main() -> None:
    im = Image.open(REF).convert("RGB")
    w, h = im.size
    left = max(0, int(CX_SRC - R_OUT - PAD))
    top = max(0, int(CY_SRC - R_OUT - PAD))
    right = min(w, int(CX_SRC + R_OUT + PAD))
    bottom = min(h, int(CY_SRC + R_OUT + PAD))
    size = min(right - left, bottom - top)
    cropped = im.crop((left, top, left + size, top + size))
    OUT_IMG.parent.mkdir(parents=True, exist_ok=True)
    cropped.save(OUT_IMG, optimize=True)

    cx = CX_SRC - left
    cy = CY_SRC - top

    px = im.load()
    rad = math.radians(JOY_SPOKE_DEG)
    transitions: list[int] = []
    prev_white = True
    for r in range(5, int(R_OUT)):
        x = int(CX_SRC + r * math.cos(rad))
        y = int(CY_SRC + r * math.sin(rad))
        c = px[x, y]
        white = c[0] > 250 and c[1] > 250 and c[2] > 250
        if white != prev_white:
            transitions.append(r)
            prev_white = white

    spec = {
        "viewSize": size,
        "center": [round(cx, 2), round(cy, 2)],
        "joySpokeDeg": JOY_SPOKE_DEG,
        "outerRadius": R_OUT,
        "rHole": 32,
        "r1": 102,
        "r2": 198,
        "r3": 286,
        "rTip": 452,
        "ringSlit": 3,
        "petalGapDeg": 2.2,
        "innerHalf": 5.6,
        "midHalf": 10.2,
        "outerHalf": 14.2,
        "transitionsAlongJoy": transitions[:14],
    }
    OUT_JSON.write_text(json.dumps(spec, indent=2), encoding="utf-8")
    print("saved", OUT_IMG, size)
    print(json.dumps(spec, indent=2))


if __name__ == "__main__":
    main()

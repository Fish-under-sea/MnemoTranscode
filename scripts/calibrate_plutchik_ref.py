"""沿瓣轴扫描参考图，估计环半径与角宽"""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image

REF = Path(
    r"C:\Users\Fish\.cursor\projects\d-Fish-code-MTC-MTC-Cursor\assets"
    r"\c__Users_Fish_AppData_Roaming_Cursor_User_workspaceStorage_fd9e19e293e6d5b4cb81b242bec39ab4_images_image-b333753e-991e-4b47-af0c-f596622ea467.png"
)

CX, CY = 531.0, 490.0


def is_white(c: tuple[int, int, int], t: int = 250) -> bool:
    return c[0] >= t and c[1] >= t and c[2] >= t


def scan_ray(angle_deg: float) -> list[tuple[int, tuple[int, int, int]]]:
    im = Image.open(REF).convert("RGB")
    px = im.load()
    rad = math.radians(angle_deg)
    out: list[tuple[int, tuple[int, int, int]]] = []
    prev_white = True
    for r in range(5, 485):
        x = int(CX + r * math.cos(rad))
        y = int(CY + r * math.sin(rad))
        c = px[x, y]
        white = is_white(c)
        if white != prev_white:
            out.append((r, c))
            prev_white = white
    return out


def main() -> None:
    for ang in [-90, -67.5, -45]:
        print(f"\n=== angle {ang} ===")
        transitions = scan_ray(ang)
        for r, c in transitions[:20]:
            print(f"  r={r:3d} #{c[0]:02x}{c[1]:02x}{c[2]:02x}")


if __name__ == "__main__":
    main()

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image

REF = Path(
    r"C:\Users\Fish\.cursor\projects\d-Fish-code-MTC-MTC-Cursor\assets"
    r"\c__Users_Fish_AppData_Roaming_Cursor_User_workspaceStorage_fd9e19e293e6d5b4cb81b242bec39ab4_images_image-b333753e-991e-4b47-af0c-f596622ea467.png"
)


def yellow_score(c: tuple[int, int, int]) -> float:
    r, g, b = c
    return r + g - 2 * b


def main() -> None:
    im = Image.open(REF).convert("RGB")
    px = im.load()
    w, h = im.size

    best = (-1e9, 0, 0, 0)
    for cy in range(400, 580, 2):
        for cx in range(450, 610, 2):
            r = 80
            rad = math.radians(-90)
            x = int(cx + r * math.cos(rad))
            y = int(cy + r * math.sin(rad))
            if 0 <= x < w and 0 <= y < h:
                s = yellow_score(px[x, y])
                if s > best[0]:
                    best = (s, cx, cy, px[x, y])

    print("best center for yellow at top:", best)

    # find angle with max yellow at r=100
    cx, cy = best[1], best[2]
    scores = []
    for deg in range(-180, 180):
        rad = math.radians(deg)
        x = int(cx + 100 * math.cos(rad))
        y = int(cy + 100 * math.sin(rad))
        if 0 <= x < w and 0 <= y < h:
            scores.append((yellow_score(px[x, y]), deg, px[x, y]))
    scores.sort(reverse=True)
    print("top yellow angles at r=100:", scores[:5])


if __name__ == "__main__":
    main()

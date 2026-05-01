"""
头像图像：边长限制 + 无损重打包（WebP lossless / PNG optimize），尽量减小体积。
不改变像素语义的前提下：可降分辨率（LANCZOS）以适配展示与存储上限。
"""

from __future__ import annotations

import io

from PIL import Image

# 接受的原图上限（用户可传大图，在此压缩后再入 MinIO）
AVATAR_MAX_RAW_BYTES = 32 * 1024 * 1024
# 入库对象上限（压缩后）
AVATAR_MAX_STORED_BYTES = 3 * 1024 * 1024
# 优先尝试的最大边长（像素），仍过大时再阶梯缩小
AVATAR_MAX_SIDES = (1024, 768, 512)


def pack_avatar_for_storage(raw: bytes, filename: str = "") -> tuple[bytes, str, str]:
    """
    将头像原字节压成尽量小的无损包。

    Returns:
        (body, content_type, ext)  ext 不含点，不含 jpeg（统一 webp/png）
    """
    if not raw:
        raise ValueError("空图像")

    try:
        im = Image.open(io.BytesIO(raw))
    except Exception as e:
        raise ValueError("无法识别为图像文件") from e
    # 多帧 GIF/WebP：头像只保留当前帧（通常为第一帧）
    if getattr(im, "n_frames", 1) > 1:
        im.seek(0)
    im = im.convert("RGBA")

    last_err: Exception | None = None
    for max_side in AVATAR_MAX_SIDES:
        work = im.copy()
        if max(work.size) > max_side:
            work.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)

        webp_buf = io.BytesIO()
        try:
            work.save(
                webp_buf,
                format="WEBP",
                lossless=True,
                method=6,
            )
        except Exception as e:
            last_err = e
            webp_data = b""
        else:
            webp_data = webp_buf.getvalue()

        png_buf = io.BytesIO()
        work.save(png_buf, format="PNG", optimize=True, compress_level=9)
        png_data = png_buf.getvalue()

        if webp_data and len(webp_data) <= len(png_data):
            chosen, ctype, ext = webp_data, "image/webp", "webp"
        else:
            chosen, ctype, ext = png_data, "image/png", "png"

        if len(chosen) <= AVATAR_MAX_STORED_BYTES:
            return chosen, ctype, ext

    if last_err:
        raise ValueError(f"无法生成头像: {last_err}") from last_err
    raise ValueError("头像压缩后仍超过存储上限，请换用更小尺寸图片")

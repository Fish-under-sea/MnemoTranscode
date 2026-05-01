"""UploadFile 分块读取，避免整文件进内存并 enforce 上限。"""

from __future__ import annotations

from fastapi import HTTPException, UploadFile, status


async def read_upload_file_max(upload: UploadFile, max_bytes: int, label: str = "文件") -> bytes:
    """读取上传体至内存，单文件不超过 max_bytes。"""
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await upload.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            mb = max(1, max_bytes // (1024 * 1024))
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"{label}过大（最大约 {mb}MB）",
            )
        chunks.append(chunk)
    return b"".join(chunks)

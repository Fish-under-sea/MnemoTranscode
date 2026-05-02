"""头像 URL：从存库的 MinIO 直链解析 object key，并生成**同域可显示的**受签地址（由后端 /auth/avatar-file 从 MinIO 流式回源）。"""

from __future__ import annotations

import hashlib
import hmac
import time

from app.core.config import get_settings


def _minio_host_variants() -> list[str]:
    s = get_settings()
    hosts: list[str] = [s.minio_endpoint]
    public = (s.minio_public_endpoint or "").strip()
    if public and public not in hosts:
        hosts.append(public)
    out: list[str] = list(hosts)
    for h in hosts:
        if h.startswith("localhost:"):
            out.append("127.0.0.1" + h[9:])
        elif h.startswith("127.0.0.1:"):
            out.append("localhost:" + h[10:])
    return list(dict.fromkeys(out))


def _minio_url_prefixes() -> list[str]:
    bucket = get_settings().minio_bucket
    out: list[str] = []
    for host in _minio_host_variants():
        out.append(f"http://{host}/{bucket}/")
        out.append(f"https://{host}/{bucket}/")
    return out


def parse_object_key_from_stored_url(avatar_url: str | None) -> str | None:
    """从库内或历史上任意 MinIO 直链中解析出 object key。"""
    if not avatar_url or not (avatar_url := avatar_url.strip()):
        return None
    bucket = get_settings().minio_bucket
    for p in _minio_url_prefixes():
        if avatar_url.startswith(p):
            rest = avatar_url[len(p) :]
            return rest.split("?", 1)[0].split("#", 1)[0]
    if "//minio:" in avatar_url and bucket in avatar_url:
        for marker in (f"/{bucket}/", f"{bucket}/"):
            i = avatar_url.find(marker)
            if i != -1:
                return avatar_url[i + len(marker) :].split("?", 1)[0]
    return None


def _avatar_file_signature(user_id: int, object_key: str, exp: int) -> str:
    s = get_settings()
    msg = f"{user_id}:{object_key}:{exp}".encode("utf-8")
    return hmac.new(s.secret_key.encode("utf-8"), msg, hashlib.sha256).hexdigest()


def verify_avatar_file_signature(
    user_id: int, stored_url: str | None, exp: int, sig: str
) -> bool:
    key = parse_object_key_from_stored_url(stored_url)
    if not key:
        return False
    if int(time.time()) > exp:
        return False
    expected = _avatar_file_signature(user_id, key, exp)
    return hmac.compare_digest(expected, sig)


def _member_avatar_signature(
    owner_id: int, archive_id: int, member_id: int, object_key: str, exp: int
) -> str:
    s = get_settings()
    msg = f"{owner_id}:{archive_id}:{member_id}:{object_key}:{exp}".encode("utf-8")
    return hmac.new(s.secret_key.encode("utf-8"), msg, hashlib.sha256).hexdigest()


def verify_member_avatar_file_signature(
    owner_id: int,
    archive_id: int,
    member_id: int,
    stored_url: str | None,
    exp: int,
    sig: str,
) -> bool:
    key = parse_object_key_from_stored_url(stored_url)
    if not key:
        return False
    if int(time.time()) > exp:
        return False
    expected = _member_avatar_signature(owner_id, archive_id, member_id, key, exp)
    return hmac.compare_digest(expected, sig)


def build_member_avatar_display_url(
    owner_id: int,
    archive_id: int,
    member_id: int,
    stored_avatar_url: str | None,
) -> str | None:
    """成员头像：同源 /api 拉流，参数与用户头像一致地依赖 HMAC + 过期时间。"""
    key = parse_object_key_from_stored_url(stored_avatar_url)
    if not key:
        return None
    s = get_settings()
    exp = int(time.time()) + int(s.minio_presign_avatar_hours * 3600)
    sig = _member_avatar_signature(owner_id, archive_id, member_id, key, exp)
    path = (
        f"/api/v1/archives/{archive_id}/members/{member_id}/avatar-file"
        f"?exp={exp}&sig={sig}"
    )
    base = (s.app_public_origin or "").strip().rstrip("/")
    if base:
        return f"{base}{path}"
    return path


def build_avatar_display_url(user_id: int, stored_avatar_url: str | None) -> str | None:
    """返回可放在 <img src> 的地址：同源 /api 反代，无需浏览器直连 MinIO、不依赖预签名外网。

    前后端分离且 API 不同域时，设置 app_public_origin 为对浏览器可见的 API 根，如 https://api.example.com
    """
    key = parse_object_key_from_stored_url(stored_avatar_url)
    if not key:
        return None
    s = get_settings()
    exp = int(time.time()) + int(s.minio_presign_avatar_hours * 3600)
    sig = _avatar_file_signature(user_id, key, exp)
    path = f"/api/v1/auth/avatar-file?uid={user_id}&exp={exp}&sig={sig}"
    base = (s.app_public_origin or "").strip().rstrip("/")
    if base:
        return f"{base}{path}"
    return path


def _app_background_file_signature(user_id: int, object_key: str, exp: int) -> str:
    s = get_settings()
    msg = f"app_bg:{user_id}:{object_key}:{exp}".encode("utf-8")
    return hmac.new(s.secret_key.encode("utf-8"), msg, hashlib.sha256).hexdigest()


def verify_app_background_file_signature(user_id: int, stored_url: str | None, exp: int, sig: str) -> bool:
    key = parse_object_key_from_stored_url(stored_url)
    if not key:
        return False
    if int(time.time()) > exp:
        return False
    expected = _app_background_file_signature(user_id, key, exp)
    return hmac.compare_digest(expected, sig)


def build_app_background_display_url(user_id: int, stored_minio_url: str | None) -> str | None:
    """与头像一致：同源 /api GET 流式回源，浏览器可给 <img> / CSS / <video src> 使用。"""
    key = parse_object_key_from_stored_url(stored_minio_url)
    if not key:
        return None
    s = get_settings()
    exp = int(time.time()) + int(s.minio_presign_avatar_hours * 3600)
    sig = _app_background_file_signature(user_id, key, exp)
    path = f"/api/v1/preferences/app-background-file?uid={user_id}&exp={exp}&sig={sig}"
    base = (s.app_public_origin or "").strip().rstrip("/")
    if base:
        return f"{base}{path}"
    return path


def browser_app_background_url(user_id: int, stored: str | None) -> str | None:
    """API 响应用：MinIO 内链 → 受签同域地址；外链 / data URI 原样透出。"""
    if not stored or not (stored := stored.strip()):
        return None
    if parse_object_key_from_stored_url(stored):
        return build_app_background_display_url(user_id, stored)
    return stored

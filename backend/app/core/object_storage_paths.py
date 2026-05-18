"""
MinIO 对象键路径约定（用户名 / 角色名 层级，替代裸 user_id 根目录）。

新上传均走本模块；库内已存的 object_key 不需迁移即可继续访问。
"""

from __future__ import annotations

import re
import unicodedata

from app.models.memory import Member
from app.models.user import User


def slug_for_object_path(raw: str, *, max_len: int = 48, fallback: str = "unnamed") -> str:
    """生成路径安全片段：保留中文 / 字母 / 数字，去掉斜杠与控制字符。"""
    s = unicodedata.normalize("NFKC", (raw or "").strip())
    if not s:
        return fallback
    s = s.replace("/", "_").replace("\\", "_")
    s = re.sub(r"\s+", "-", s)
    # 字母数字、连字符、点、下划线、其他 Unicode「单词」字符（含中日韩）
    s = re.sub(r"[^\w\-.]+", "_", s, flags=re.UNICODE)
    s = s.strip("._-") or fallback
    if len(s) > max_len:
        s = s[:max_len].rstrip("._-") or fallback
    return s


def user_root_prefix(user: User) -> str:
    """用户命名空间：users/{用户名 slug}-{用户 id}（id 后缀防止改名碰撞）。"""
    label = slug_for_object_path(user.username or "", fallback=f"user{user.id}")
    return f"users/{label}-{user.id}"


def member_roles_prefix(user: User, member: Member) -> str:
    """角色（成员）媒体目录：users/.../roles/{角色名}-{成员 id}。"""
    role = slug_for_object_path(member.name, fallback=f"role{member.id}")
    return f"{user_root_prefix(user)}/roles/{role}-{member.id}"


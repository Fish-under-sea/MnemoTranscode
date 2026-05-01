"""
记忆胶囊 API 路由

定时解封的记忆传承功能
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import verify_password
from app.models.user import User
from app.models.memory import MemoryCapsule, Member, Archive
from app.api.v1.auth import get_current_user

router = APIRouter(prefix="/capsules", tags=["记忆胶囊"])

PydanticBase = None  # 避免循环导入，简化为字典返回


class ForceUnlockCapsuleBody(BaseModel):
    """使用当前登录账号的密码强制解封。"""

    password: str = Field(..., min_length=1, max_length=256)


def _as_utc(dt: datetime) -> datetime:
    """将 naive 视作 UTC，aware 则归一到 UTC，便于与 ORM DateTime(timezone=True) 比较。"""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_capsule(
    member_id: int,
    title: str,
    content: str,
    unlock_date: datetime,
    recipients: list[int] | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建记忆胶囊"""
    result = await db.execute(
        select(Member)
        .join(Archive, Member.archive_id == Archive.id)
        .where(Member.id == member_id, Archive.owner_id == current_user.id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=403, detail="无权限")

    capsule = MemoryCapsule(
        member_id=member_id,
        title=title,
        content=content,
        unlock_date=unlock_date,
        recipients=recipients or [],
        status="locked",
    )
    db.add(capsule)
    await db.commit()
    await db.refresh(capsule)

    return {
        "id": capsule.id,
        "title": capsule.title,
        "unlock_date": capsule.unlock_date.isoformat(),
        "status": capsule.status,
        "created_at": capsule.created_at.isoformat(),
    }


@router.get("")
async def list_capsules(
    member_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取记忆胶囊列表"""
    query = select(MemoryCapsule).join(Member).join(Archive).where(
        Archive.owner_id == current_user.id
    )
    if member_id:
        query = query.where(MemoryCapsule.member_id == member_id)

    result = await db.execute(query.order_by(MemoryCapsule.unlock_date.desc()))
    capsules = result.scalars().all()

    return [
        {
            "id": c.id,
            "member_id": c.member_id,
            "title": c.title,
            "unlock_date": c.unlock_date.isoformat(),
            "status": c.status,
            "created_at": c.created_at.isoformat(),
        }
        for c in capsules
    ]


@router.get("/{capsule_id}")
async def get_capsule(
    capsule_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取胶囊详情（未解锁时只返回元数据）"""
    result = await db.execute(
        select(MemoryCapsule)
        .join(Member)
        .join(Archive)
        .where(MemoryCapsule.id == capsule_id, Archive.owner_id == current_user.id)
    )
    capsule = result.scalar_one_or_none()
    if not capsule:
        raise HTTPException(status_code=404, detail="胶囊不存在")

    now = datetime.now(timezone.utc)
    unlock = _as_utc(capsule.unlock_date)
    if unlock > now and capsule.status == "locked":
        return {
            "id": capsule.id,
            "title": capsule.title,
            "status": "locked",
            "unlock_date": capsule.unlock_date.isoformat(),
            "message": "此胶囊尚未解锁",
        }

    return {
        "id": capsule.id,
        "member_id": capsule.member_id,
        "title": capsule.title,
        "content": capsule.content,
        "unlock_date": capsule.unlock_date.isoformat(),
        "status": capsule.status,
        "created_at": capsule.created_at.isoformat(),
    }


@router.post("/{capsule_id}/force-unlock")
async def force_unlock_capsule(
    capsule_id: int,
    body: ForceUnlockCapsuleBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """未到解封时间时，凭当前账号登录密码强制解封（仅本人档案下的胶囊）。"""
    result = await db.execute(
        select(MemoryCapsule)
        .join(Member)
        .join(Archive)
        .where(MemoryCapsule.id == capsule_id, Archive.owner_id == current_user.id)
    )
    capsule = result.scalar_one_or_none()
    if not capsule:
        raise HTTPException(status_code=404, detail="胶囊不存在")

    if capsule.status == "delivered":
        raise HTTPException(status_code=400, detail="胶囊已解封，无需强制解锁")

    if not verify_password(body.password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="密码不正确")

    now = datetime.now(timezone.utc)
    capsule.status = "delivered"
    capsule.delivered_at = now
    await db.commit()
    await db.refresh(capsule)

    return {
        "id": capsule.id,
        "member_id": capsule.member_id,
        "title": capsule.title,
        "content": capsule.content,
        "unlock_date": capsule.unlock_date.isoformat(),
        "status": capsule.status,
        "created_at": capsule.created_at.isoformat(),
    }

"""
档案管理 API 路由
"""

import io
import uuid
from datetime import datetime, timezone
from typing import Annotated, Literal

from fastapi.encoders import jsonable_encoder

from fastapi import APIRouter, Depends, status, Query, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.exceptions import DomainAuthError, DomainResourceError
from app.core.database import get_db
from app.core.config import get_settings
from app.core.avatar_public_url import (
    build_member_avatar_display_url,
    parse_object_key_from_stored_url,
    verify_member_avatar_file_signature,
)
from app.core.minio_object_response import raise_if_expired, streaming_response_for_object_key
from app.models.user import User
from app.models.memory import Archive, Member, Memory
from app.models.engram import EngramEdge, EngramNode
from app.schemas.memory import (
    ArchiveCreate,
    ArchiveUpdate,
    ArchiveResponse,
    ArchiveReorderBody,
    ArchiveReorderResult,
    ArchiveRolesBackupPackageV1,
    ArchiveRolesRestoreResponse,
    ClonedMemberItem,
    MemberCloneRequest,
    MemberCloneResponse,
    MemberCreate,
    MemberUpdate,
    MemberResponse,
)
from app.api.v1.auth import get_current_user
from app.services.avatar_image import AVATAR_MAX_RAW_BYTES, pack_avatar_for_storage
from app.services.upload_bounded import read_upload_file_max
from app.services.mnemo_graph_query import list_pruned_engrams_for_member

router = APIRouter(prefix="/archives", tags=["档案"])

settings = get_settings()


def _heritage_preview_from_members(members: list[Member] | None) -> str | None:
    """取档案卡片列表用：第一家有「发源地」著录的非空预览。"""
    if not members:
        return None
    for mem in sorted(members, key=lambda x: int(x.id)):
        raw = getattr(mem, "heritage_origin_regions", None)
        if isinstance(raw, str) and raw.strip():
            return raw.strip()
    return None


def _archive_response(
    archive: Archive,
    *,
    member_count: int,
    memory_count: int,
    heritage_preview: str | None = None,
    derive_heritage_preview_from_members: bool = False,
) -> ArchiveResponse:
    base = ArchiveResponse.model_validate(archive)
    preview = heritage_preview
    if derive_heritage_preview_from_members:
        preview = _heritage_preview_from_members(list(archive.members or []))
    return base.model_copy(
        update={
            "member_count": member_count,
            "memory_count": memory_count,
            "heritage_origin_preview": preview,
        }
    )


def _resp_ts(a: ArchiveResponse) -> float:
    """用于列表排序：将 updated_at 规整为单调时间戳"""
    dt = a.updated_at
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.timestamp()


def _sort_archive_responses(rows: list[ArchiveResponse], sort: str) -> None:
    if sort == "memory":
        pin_block = lambda r: (0 if r.is_pinned else 1, r.pinned_order if r.is_pinned else 0)
        rows.sort(key=lambda r: (*pin_block(r), -r.memory_count, r.name or ""))
    elif sort == "name":
        pin_block = lambda r: (0 if r.is_pinned else 1, r.pinned_order if r.is_pinned else 0)
        rows.sort(key=lambda r: (*pin_block(r), (r.name or "").lower()))
    elif sort == "manual":
        rows.sort(
            key=lambda r: (
                0 if r.is_pinned else 1,
                r.pinned_order if r.is_pinned else 0,
                r.manual_order if not r.is_pinned else 0,
                -_resp_ts(r),
            )
        )
    else:
        pin_block = lambda r: (0 if r.is_pinned else 1, r.pinned_order if r.is_pinned else 0)
        rows.sort(key=lambda r: (*pin_block(r), -_resp_ts(r)))


def member_to_response(member: Member, owner_id: int) -> MemberResponse:
    """序列化成员：头像 URL 转为同源可显式的签名链。"""
    base = MemberResponse.model_validate(member)
    display = build_member_avatar_display_url(owner_id, member.archive_id, member.id, member.avatar_url)
    return base.model_copy(update={"avatar_url": display})


@router.post("", response_model=ArchiveResponse, status_code=status.HTTP_201_CREATED)
async def create_archive(
    archive_data: ArchiveCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建新的档案"""
    archive = Archive(
        name=archive_data.name,
        description=archive_data.description,
        archive_type=archive_data.archive_type,
        owner_id=current_user.id,
    )
    db.add(archive)
    await db.commit()
    await db.refresh(archive)
    return _archive_response(archive, member_count=0, memory_count=0)


@router.get("", response_model=list[ArchiveResponse])
async def list_archives(
    archive_type: str | None = None,
    sort: Annotated[
        Literal["default", "manual", "name", "memory"],
        Query(description="排序：置顶块始终靠前；manual=手工顺序；其余为规则排序"),
    ] = "default",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取用户的档案列表"""
    query = (
        select(Archive)
        .options(selectinload(Archive.members).selectinload(Member.memories))
        .where(Archive.owner_id == current_user.id)
    )
    if archive_type:
        query = query.where(Archive.archive_type == archive_type)
    query = query.order_by(Archive.id.asc())
    result = await db.execute(query)
    archives = result.scalars().all()
    responses = []
    for archive in archives:
        member_count = len(archive.members) if archive.members else 0
        memory_count = sum(len(m.memories) for m in archive.members) if archive.members else 0
        resp = _archive_response(
            archive,
            member_count=member_count,
            memory_count=memory_count,
            derive_heritage_preview_from_members=True,
        )
        responses.append(resp)
    _sort_archive_responses(responses, sort)
    return responses


@router.post("/reorder", response_model=ArchiveReorderResult)
async def reorder_archives(
    body: ArchiveReorderBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    手工排序：前端拖拽后提交。
    pinned_ids 须全部为已置顶档案且顺序即展示顺序；unpinned_ids 须全部为未置顶。
    """
    pinned_ids = body.pinned_ids
    unpinned_ids = body.unpinned_ids
    if not pinned_ids and not unpinned_ids:
        raise DomainResourceError(error_code="VALIDATION_ERROR", message="排序列表不能为空")

    if set(pinned_ids) & set(unpinned_ids):
        raise DomainResourceError(error_code="VALIDATION_ERROR", message="置顶与未置顶 id 不能重复")

    all_ids = [*pinned_ids, *unpinned_ids]
    result = await db.execute(
        select(Archive).where(Archive.owner_id == current_user.id, Archive.id.in_(all_ids))
    )
    rows = result.scalars().all()
    by_id = {a.id: a for a in rows}
    if len(by_id) != len(all_ids):
        raise DomainResourceError(error_code="RESOURCE_NOT_FOUND", message="部分档案不存在或无权限")

    for aid in pinned_ids:
        a = by_id[aid]
        if not a.is_pinned:
            raise DomainResourceError(error_code="VALIDATION_ERROR", message="置顶序列中含未置顶档案")
    for aid in unpinned_ids:
        if by_id[aid].is_pinned:
            raise DomainResourceError(error_code="VALIDATION_ERROR", message="未置顶序列中含已置顶档案")

    for i, aid in enumerate(pinned_ids):
        by_id[aid].pinned_order = (i + 1) * 10
    for i, aid in enumerate(unpinned_ids):
        by_id[aid].manual_order = (i + 1) * 10

    await db.commit()
    return ArchiveReorderResult()


@router.get("/{archive_id}", response_model=ArchiveResponse)
async def get_archive(
    archive_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取档案详情"""
    result = await db.execute(
        select(Archive)
        .options(selectinload(Archive.members).selectinload(Member.memories))
        .where(Archive.id == archive_id, Archive.owner_id == current_user.id)
    )
    archive = result.scalar_one_or_none()
    if not archive:
        raise DomainResourceError(error_code="RESOURCE_NOT_FOUND", message="档案不存在")
    return _archive_response(
        archive,
        member_count=len(archive.members),
        memory_count=sum(len(m.memories) for m in archive.members),
        derive_heritage_preview_from_members=True,
    )


@router.patch("/{archive_id}", response_model=ArchiveResponse)
async def update_archive(
    archive_id: int,
    update_data: ArchiveUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新档案信息"""
    result = await db.execute(
        select(Archive).options(selectinload(Archive.members).selectinload(Member.memories)).where(Archive.id == archive_id, Archive.owner_id == current_user.id)
    )
    archive = result.scalar_one_or_none()
    if not archive:
        raise DomainResourceError(error_code="RESOURCE_NOT_FOUND", message="档案不存在")

    member_count = len(archive.members) if archive.members else 0
    memory_count = sum(len(m.memories) for m in archive.members) if archive.members else 0

    data = update_data.model_dump(exclude_unset=True)
    pin_req = data.pop("is_pinned", None)

    if pin_req is True:
        if not archive.is_pinned:
            min_stmt = select(func.min(Archive.pinned_order)).where(
                Archive.owner_id == current_user.id,
                Archive.is_pinned.is_(True),
            )
            min_o = await db.scalar(min_stmt)
            archive.is_pinned = True
            archive.pinned_order = (min_o if min_o is not None else 1000) - 1
    elif pin_req is False:
        archive.is_pinned = False
        archive.pinned_order = 0

    for field, value in data.items():
        setattr(archive, field, value)
    await db.commit()
    await db.refresh(archive)

    return _archive_response(
        archive,
        member_count=member_count,
        memory_count=memory_count,
        derive_heritage_preview_from_members=True,
    )


@router.delete("/{archive_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_archive(
    archive_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除档案"""
    result = await db.execute(
        select(Archive).where(Archive.id == archive_id, Archive.owner_id == current_user.id)
    )
    archive = result.scalar_one_or_none()
    if not archive:
        raise DomainResourceError(error_code="RESOURCE_NOT_FOUND", message="档案不存在")
    await db.delete(archive)
    await db.commit()


# ====== 成员管理 ======

@router.post("/{archive_id}/members", response_model=MemberResponse, status_code=status.HTTP_201_CREATED)
async def create_member(
    archive_id: int,
    member_data: MemberCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """在档案下创建成员"""
    result = await db.execute(
        select(Archive).where(Archive.id == archive_id, Archive.owner_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise DomainAuthError(error_code="AUTH_FORBIDDEN", message="无权限")

    member = Member(
        name=member_data.name,
        relationship_type=member_data.relationship_type,
        archive_id=archive_id,
        birth_year=member_data.birth_year,
        status=member_data.status or "active",
        end_year=member_data.end_year,
        bio=member_data.bio,
        heritage_origin_regions=member_data.heritage_origin_regions,
        heritage_listing_level=member_data.heritage_listing_level,
        heritage_inscribed_year=member_data.heritage_inscribed_year,
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return member_to_response(member, current_user.id)


@router.get("/{archive_id}/members", response_model=list[MemberResponse])
async def list_members(
    archive_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取档案下的所有成员"""
    result = await db.execute(
        select(Archive).where(Archive.id == archive_id, Archive.owner_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise DomainAuthError(error_code="AUTH_FORBIDDEN", message="无权限")

    result = await db.execute(
        select(Member).where(Member.archive_id == archive_id).order_by(Member.birth_year)
    )
    members = result.scalars().all()
    return [member_to_response(m, current_user.id) for m in members]


def _apply_clone_suffix(name: str, name_suffix: str | None) -> str:
    base = name.strip()
    if not base:
        return "未命名角色"
    if name_suffix is None or str(name_suffix).strip() == "":
        out = base
    else:
        out = base + str(name_suffix).strip()
    return out[:100]


async def _clone_member_mnemo_graph(
    db: AsyncSession,
    *,
    user_id: int,
    src_member_id: int,
    dst_member_id: int,
    mem_id_map: dict[int, int],
) -> int:
    """将源成员裁剪后的 Engram 子图克隆到目标成员（边与记忆 id 均已重映射）。"""
    nodes_orm, edges_orm = await list_pruned_engrams_for_member(
        db, user_id=user_id, member_id=src_member_id
    )
    if not nodes_orm:
        return 0
    now = datetime.now(timezone.utc)
    old_to_new: dict[str, str] = {}
    for n in nodes_orm:
        nid = str(uuid.uuid4())
        old_to_new[n.id] = nid
        mem_new: int | None = None
        if n.memory_id is not None and n.memory_id in mem_id_map:
            mem_new = mem_id_map[n.memory_id]
        elif n.memory_id is not None:
            mem_new = None
        db.add(
            EngramNode(
                id=nid,
                user_id=user_id,
                member_id=dst_member_id,
                memory_id=mem_new,
                node_type=n.node_type[:64],
                content=(n.content or "")[:50_000],
                importance=float(n.importance or 0.5),
                activation_energy=float(n.activation_energy or 0.5),
                decay_rate=float(n.decay_rate or 0.02),
                plasticity=float(n.plasticity or 0.8),
                last_access=now,
                access_count=max(0, int(n.access_count or 0)),
                is_deprecated=False,
            )
        )
    await db.flush()
    for e in edges_orm:
        fa = old_to_new.get(e.from_node_id)
        ta = old_to_new.get(e.to_node_id)
        if not fa or not ta:
            continue
        meta = e.meta if isinstance(e.meta, dict) else None
        db.add(
            EngramEdge(
                from_node_id=fa,
                to_node_id=ta,
                edge_type=e.edge_type[:64],
                weight=float(e.weight or 0.5),
                coactivation_count=int(e.coactivation_count or 0),
                meta=meta,
            )
        )
    return len(nodes_orm)


@router.get("/{archive_id}/members/backup")
async def backup_archive_roles(
    archive_id: int,
    include_memories: bool = Query(True, description="是否导出各角色下的记忆"),
    include_mnemo_graph: bool = Query(
        True, description="在导出记忆时是否一并导出各成员 Mnemo（Engram）关系网快照"
    ),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """导出当前档案全部角色（及可选记忆与关系网快照）为 JSON，供备份或迁移。"""
    result = await db.execute(
        select(Archive)
        .where(Archive.id == archive_id, Archive.owner_id == current_user.id)
        .options(selectinload(Archive.members).selectinload(Member.memories))
    )
    archive = result.scalar_one_or_none()
    if not archive:
        raise DomainResourceError(error_code="RESOURCE_NOT_FOUND", message="档案不存在")

    id_to_key: dict[int, str] = {}
    members_out: list[dict] = []
    for mem in sorted(archive.members or [], key=lambda x: x.id):
        ek = str(uuid.uuid4())
        id_to_key[mem.id] = ek
        etags = mem.emotion_tags if mem.emotion_tags is not None else []
        if not isinstance(etags, list):
            etags = []
        members_out.append(
            {
                "export_key": ek,
                "name": mem.name,
                "relationship_type": mem.relationship_type,
                "birth_year": mem.birth_year,
                "status": mem.status or "active",
                "end_year": mem.end_year,
                "bio": mem.bio,
                "emotion_tags": etags,
                "mnemo_self_core": mem.mnemo_self_core,
                "avatar_url": mem.avatar_url,
                "heritage_origin_regions": mem.heritage_origin_regions,
                "heritage_listing_level": mem.heritage_listing_level,
                "heritage_inscribed_year": mem.heritage_inscribed_year,
            }
        )

    memories_out: list[dict] = []
    memory_id_to_export_key: dict[int, str] = {}
    if include_memories and archive.members:
        for src in archive.members:
            key = id_to_key.get(src.id)
            if not key:
                continue
            for row in sorted(src.memories or [], key=lambda x: x.id):
                mek = str(uuid.uuid4())
                memory_id_to_export_key[row.id] = mek
                mrefs = row.media_refs if row.media_refs is not None else []
                if not isinstance(mrefs, list):
                    mrefs = []
                memories_out.append(
                    {
                        "member_export_key": key,
                        "memory_export_key": mek,
                        "title": row.title,
                        "content_text": row.content_text,
                        "timestamp": row.timestamp,
                        "location": row.location,
                        "emotion_label": row.emotion_label,
                        "media_refs": mrefs,
                    }
                )

    mnemo_graphs_out: list[dict] = []
    if include_memories and include_mnemo_graph and archive.members:
        for mem in sorted(archive.members or [], key=lambda x: x.id):
            ek = id_to_key.get(mem.id)
            if not ek:
                continue
            nodes_orm, edges_orm = await list_pruned_engrams_for_member(
                db, user_id=current_user.id, member_id=int(mem.id)
            )
            if not nodes_orm and not edges_orm:
                continue
            nodes_json: list[dict] = []
            for n in nodes_orm:
                mev = memory_id_to_export_key.get(int(n.memory_id)) if n.memory_id is not None else None
                nodes_json.append(
                    {
                        "old_id": n.id,
                        "node_type": n.node_type,
                        "content": n.content or "",
                        "memory_export_key": mev,
                        "activation_energy": float(n.activation_energy or 0.5),
                        "decay_rate": float(n.decay_rate or 0.02),
                        "plasticity": float(n.plasticity or 0.8),
                        "importance": float(n.importance or 0.5),
                        "access_count": int(n.access_count or 0),
                    }
                )
            edges_json: list[dict] = []
            for e in edges_orm:
                em = e.meta if isinstance(e.meta, dict) else None
                edges_json.append(
                    {
                        "from_id": e.from_node_id,
                        "to_id": e.to_node_id,
                        "edge_type": e.edge_type,
                        "weight": float(e.weight or 0.5),
                        "coactivation_count": int(e.coactivation_count or 0),
                        "meta": em,
                    }
                )
            if nodes_json:
                mnemo_graphs_out.append(
                    {"member_export_key": ek, "nodes": nodes_json, "edges": edges_json}
                )

    payload = {
        "format": "mtc-archive-roles-v2",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "archive": {
            "source_archive_id": archive.id,
            "name": archive.name,
            "description": archive.description,
            "archive_type": archive.archive_type,
        },
        "members": members_out,
        "memories": memories_out,
        "mnemo_graphs": mnemo_graphs_out,
    }
    return JSONResponse(
        content=jsonable_encoder(payload),
        headers={
            "Content-Disposition": f'attachment; filename="mtc-archive-{archive_id}-roles-backup.json"'
        },
    )


@router.post("/{archive_id}/members/clone", response_model=MemberCloneResponse)
async def clone_archive_roles(
    archive_id: int,
    body: MemberCloneRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """在**同一档案**内克隆所选角色（可选附带记忆与 Mnemo 关系网拓扑）。"""
    result = await db.execute(
        select(Archive).where(Archive.id == archive_id, Archive.owner_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise DomainAuthError(error_code="AUTH_FORBIDDEN", message="无权限")

    mids = sorted({int(x) for x in body.member_ids if int(x) > 0})
    if not mids:
        raise DomainResourceError(error_code="RESOURCE_NOT_FOUND", message="无效的 member_ids")

    q = select(Member).where(Member.archive_id == archive_id, Member.id.in_(mids)).order_by(Member.id)
    if body.include_memories:
        q = q.options(selectinload(Member.memories))
    rs = await db.execute(q)
    sources = list(rs.scalars().all())
    if len(sources) != len(mids):
        raise DomainResourceError(error_code="RESOURCE_NOT_FOUND", message="部分成员不存在或无权克隆")

    mid_to_src = {m.id: m for m in sources}
    cloned_out: list[ClonedMemberItem] = []
    mem_cnt = 0
    mnemo_node_cnt = 0
    for mid in mids:
        src = mid_to_src.get(mid)
        if not src:
            continue
        etags_src = src.emotion_tags if isinstance(src.emotion_tags, list) else []
        nm = Member(
            name=_apply_clone_suffix(src.name, body.name_suffix),
            relationship_type=src.relationship_type,
            archive_id=archive_id,
            birth_year=src.birth_year,
            status=src.status or "active",
            end_year=src.end_year,
            bio=src.bio,
            avatar_url=src.avatar_url,
            emotion_tags=list(etags_src),
            mnemo_self_core=src.mnemo_self_core,
            heritage_origin_regions=src.heritage_origin_regions,
            heritage_listing_level=src.heritage_listing_level,
            heritage_inscribed_year=src.heritage_inscribed_year,
            voice_profile_id=None,
        )
        db.add(nm)
        await db.flush()
        await db.refresh(nm)
        cloned_out.append(ClonedMemberItem(source_member_id=src.id, new_member_id=nm.id))
        mem_id_map: dict[int, int] = {}
        if body.include_memories and src.memories:
            for memo in sorted(src.memories, key=lambda x: x.id):
                mrefs = memo.media_refs if isinstance(memo.media_refs, list) else []
                new_mem = Memory(
                    title=memo.title[:200],
                    content_text=memo.content_text,
                    member_id=nm.id,
                    timestamp=memo.timestamp,
                    location=memo.location,
                    emotion_label=memo.emotion_label,
                    vector_embedding_id=None,
                    media_refs=list(mrefs),
                    is_capsule=memo.is_capsule,
                    unlock_date=memo.unlock_date,
                )
                db.add(new_mem)
                await db.flush()
                await db.refresh(new_mem)
                mem_id_map[memo.id] = new_mem.id
                mem_cnt += 1
            mnemo_node_cnt += await _clone_member_mnemo_graph(
                db,
                user_id=current_user.id,
                src_member_id=src.id,
                dst_member_id=nm.id,
                mem_id_map=mem_id_map,
            )
    await db.commit()
    return MemberCloneResponse(cloned=cloned_out, memories_copied=mem_cnt, mnemo_nodes_copied=mnemo_node_cnt)


@router.post("/{archive_id}/members/restore", response_model=ArchiveRolesRestoreResponse)
async def restore_archive_roles(
    archive_id: int,
    payload: ArchiveRolesBackupPackageV1,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """将备份 JSON 中的角色恢复到**当前档案**（新建条目，不覆盖已有）。"""
    result = await db.execute(
        select(Archive).where(Archive.id == archive_id, Archive.owner_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise DomainAuthError(error_code="AUTH_FORBIDDEN", message="无权限")

    ek_to_mid: dict[str, int] = {}
    new_ids: list[int] = []
    for pm in payload.members:
        et = pm.emotion_tags if isinstance(pm.emotion_tags, list) else []
        nm = Member(
            name=pm.name[:100],
            relationship_type=pm.relationship_type[:50],
            archive_id=archive_id,
            birth_year=pm.birth_year,
            status=(pm.status or "active")[:16],
            end_year=pm.end_year,
            bio=pm.bio,
            avatar_url=pm.avatar_url,
            emotion_tags=list(et),
            mnemo_self_core=pm.mnemo_self_core,
            voice_profile_id=None,
            heritage_origin_regions=pm.heritage_origin_regions,
            heritage_listing_level=pm.heritage_listing_level,
            heritage_inscribed_year=pm.heritage_inscribed_year,
        )
        db.add(nm)
        await db.flush()
        await db.refresh(nm)
        ek_to_mid[pm.export_key] = nm.id
        new_ids.append(nm.id)

    mc = 0
    mek_to_mid_mem: dict[str, int] = {}
    for pr in payload.memories:
        target_mid = ek_to_mid.get(pr.member_export_key)
        if target_mid is None:
            continue
        mrefs = pr.media_refs if isinstance(pr.media_refs, list) else []
        row_m = Memory(
            title=pr.title[:200],
            content_text=pr.content_text,
            member_id=target_mid,
            timestamp=pr.timestamp,
            location=pr.location[:255] if pr.location else None,
            emotion_label=pr.emotion_label,
            vector_embedding_id=None,
            media_refs=list(mrefs),
        )
        db.add(row_m)
        await db.flush()
        await db.refresh(row_m)
        if pr.memory_export_key:
            mek_to_mid_mem[pr.memory_export_key] = row_m.id
        mc += 1

    mnemo_created = 0
    if payload.mnemo_graphs:
        now_ts = datetime.now(timezone.utc)
        for graph in payload.mnemo_graphs:
            tgt_mid = ek_to_mid.get(graph.member_export_key)
            if tgt_mid is None:
                continue
            old_to_new: dict[str, str] = {}
            for pn in graph.nodes:
                nid = str(uuid.uuid4())
                old_to_new[pn.old_id] = nid
                mem_rid: int | None = None
                if pn.memory_export_key:
                    mem_rid = mek_to_mid_mem.get(pn.memory_export_key)
                db.add(
                    EngramNode(
                        id=nid,
                        user_id=current_user.id,
                        member_id=tgt_mid,
                        memory_id=mem_rid,
                        node_type=pn.node_type[:64],
                        content=(pn.content or "")[:50_000],
                        activation_energy=float(pn.activation_energy),
                        decay_rate=float(pn.decay_rate),
                        plasticity=float(pn.plasticity),
                        importance=float(pn.importance),
                        last_access=now_ts,
                        access_count=max(0, int(pn.access_count)),
                        is_deprecated=False,
                    )
                )
            await db.flush()
            for pe in graph.edges:
                fa = old_to_new.get(pe.from_id)
                ta = old_to_new.get(pe.to_id)
                if not fa or not ta:
                    continue
                em = pe.meta if isinstance(pe.meta, dict) else None
                db.add(
                    EngramEdge(
                        from_node_id=fa,
                        to_node_id=ta,
                        edge_type=pe.edge_type[:64],
                        weight=float(pe.weight or 0.5),
                        coactivation_count=int(pe.coactivation_count or 0),
                        meta=em,
                    )
                )
            mnemo_created += len(graph.nodes)

    await db.commit()
    return ArchiveRolesRestoreResponse(
        created_member_ids=new_ids,
        memories_created=mc,
        mnemo_nodes_created=mnemo_created,
    )


@router.get("/{archive_id}/members/{member_id}", response_model=MemberResponse)
async def get_member(
    archive_id: int,
    member_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取成员详情"""
    result = await db.execute(
        select(Archive).where(Archive.id == archive_id, Archive.owner_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise DomainAuthError(error_code="AUTH_FORBIDDEN", message="无权限")

    result = await db.execute(
        select(Member).where(Member.id == member_id, Member.archive_id == archive_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise DomainResourceError(error_code="RESOURCE_NOT_FOUND", message="成员不存在")
    return member_to_response(member, current_user.id)


@router.patch("/{archive_id}/members/{member_id}", response_model=MemberResponse)
async def update_member(
    archive_id: int,
    member_id: int,
    update_data: MemberUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新成员信息"""
    result = await db.execute(
        select(Archive).where(Archive.id == archive_id, Archive.owner_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise DomainAuthError(error_code="AUTH_FORBIDDEN", message="无权限")

    result = await db.execute(
        select(Member).where(Member.id == member_id, Member.archive_id == archive_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise DomainResourceError(error_code="RESOURCE_NOT_FOUND", message="成员不存在")

    ignored_legacy_fields = {"is_alive", "death_year"}
    for field, value in update_data.model_dump(exclude_unset=True).items():
        if field in ignored_legacy_fields:
            continue
        setattr(member, field, value)
    await db.commit()
    await db.refresh(member)
    return member_to_response(member, current_user.id)


@router.get("/{archive_id}/members/{member_id}/avatar-file")
async def get_member_avatar_file(
    archive_id: int,
    member_id: int,
    exp: int = Query(..., description="过期时间 Unix 秒"),
    sig: str = Query(..., min_length=32, max_length=128, description="HMAC-SHA256 十六进制"),
    db: AsyncSession = Depends(get_db),
):
    """成员头像原图：同源拉流，供 <img src> 使用。"""
    raise_if_expired(exp)
    result = await db.execute(
        select(Member).where(Member.id == member_id, Member.archive_id == archive_id)
    )
    member = result.scalar_one_or_none()
    if not member or not member.avatar_url:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="头像不存在")
    ar = await db.execute(select(Archive).where(Archive.id == archive_id))
    archive = ar.scalar_one_or_none()
    if not archive:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="档案不存在")
    owner_id = archive.owner_id
    if not verify_member_avatar_file_signature(
        owner_id, archive_id, member_id, member.avatar_url, exp, sig
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="签名无效")
    key = parse_object_key_from_stored_url(member.avatar_url)
    if not key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="头像数据异常")
    return streaming_response_for_object_key(key)


@router.post("/{archive_id}/members/{member_id}/avatar", response_model=MemberResponse)
async def upload_member_avatar(
    archive_id: int,
    member_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """上传并更新成员展示头像（MinIO + 同源签名 URL）。"""
    result = await db.execute(
        select(Archive).where(Archive.id == archive_id, Archive.owner_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise DomainAuthError(error_code="AUTH_FORBIDDEN", message="无权限")

    result = await db.execute(
        select(Member).where(Member.id == member_id, Member.archive_id == archive_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise DomainResourceError(error_code="RESOURCE_NOT_FOUND", message="成员不存在")

    raw = await read_upload_file_max(file, AVATAR_MAX_RAW_BYTES, "头像原图")
    try:
        content, content_type, file_ext = pack_avatar_for_storage(raw, file.filename or "")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    object_name = f"avatars/members/{member_id}/{uuid.uuid4()}.{file_ext}"

    try:
        from minio import Minio

        client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
            region="us-east-1",
        )
        bucket_name = settings.minio_bucket
        if not client.bucket_exists(bucket_name):
            client.make_bucket(bucket_name)
        client.put_object(
            bucket_name,
            object_name,
            io.BytesIO(content),
            len(content),
            content_type=content_type,
        )
        file_url = f"http://{settings.minio_endpoint}/{bucket_name}/{object_name}"
        member.avatar_url = file_url
        await db.commit()
        await db.refresh(member)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"头像上传失败: {str(e)}",
        ) from e

    return member_to_response(member, current_user.id)


@router.delete("/{archive_id}/members/{member_id}/avatar", response_model=MemberResponse)
async def delete_member_avatar(
    archive_id: int,
    member_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """移除成员自定义头像。"""
    result = await db.execute(
        select(Archive).where(Archive.id == archive_id, Archive.owner_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise DomainAuthError(error_code="AUTH_FORBIDDEN", message="无权限")

    result = await db.execute(
        select(Member).where(Member.id == member_id, Member.archive_id == archive_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise DomainResourceError(error_code="RESOURCE_NOT_FOUND", message="成员不存在")

    member.avatar_url = None
    await db.commit()
    await db.refresh(member)
    return member_to_response(member, current_user.id)


@router.delete("/{archive_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_member(
    archive_id: int,
    member_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """删除成员"""
    result = await db.execute(
        select(Archive).where(Archive.id == archive_id, Archive.owner_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise DomainAuthError(error_code="AUTH_FORBIDDEN", message="无权限")

    result = await db.execute(
        select(Member).where(Member.id == member_id, Member.archive_id == archive_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise DomainResourceError(error_code="RESOURCE_NOT_FOUND", message="成员不存在")
    await db.delete(member)
    await db.commit()

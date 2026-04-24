# 子项目 C · 核心记忆流 · 收尾记录

**完成日期**：2026-04-24  
**实现分支**：`Composer-coding`（Composer 2）  
**设计 / 合入**：Claude 4.7 Opus（计划与 PR 合入 `main` 由 Opus 侧执行）  
**执行模型**：Composer 2（实现） · Claude 4.7 Opus（规格与审查）

---

## 一句话总结

产品语言与 `status`/`end_year` 消费方全量迁移；档案/成员/记忆三页走 A 基座与 `useApiError`；记忆卡、详情抽屉、情感 Select、媒体两阶段上传与成员相册、时间线三筛选与 Drawer 联动一次性落地；后端补 `GET /api/v1/media/` 列表以支撑 Gallery。

---

## 执行时间线（按 milestone）

| Milestone | 主题 | 说明 |
|-----------|------|------|
| M1 | 产品语言 + CRUD 三页 A 基座 | `memberStatus`、MemberStatusBadge/Input、ArchiveList/Detail、MemberDetail、MemberProfile |
| M2 | MemoryCard + Drawer + emotion | MemoryCard 重做、MemoryDetailDrawer、useMemory、双页接入 Select |
| M3 | 媒体 | `mediaApi`、useMemberMedia/useMediaUrl、MediaUploader/Gallery/Lightbox、Member 相册、Drawer 内 Gallery；E 补 media 列表路由 |
| M4 | 时间线 | `timelineUtils`、`Timeline` 重写、`TimelinePage` 筛选 + Drawer |
| M5 | 收尾 | state 从 `components/ui` barrel 导出、本记录、路线图 v1.7 §十三 |

---

## 关键产出路径

- `frontend/src/lib/memberStatus.ts`
- `frontend/src/lib/timelineUtils.ts`
- `frontend/src/components/member/*`
- `frontend/src/components/memory/MemoryCard.tsx`、`MemoryDetailDrawer.tsx`
- `frontend/src/components/media/*`
- `frontend/src/hooks/useMemory.ts`、`useMemberMedia.ts`、`useMediaUrl.ts`
- `frontend/src/services/api.ts`（`mediaApi`、`uploadToPresignedUrl`）
- `frontend/src/services/memoryTypes.ts`
- `frontend/src/components/ui/index.ts`（`export * from './state'`）
- `backend/app/api/v1/media.py`（`GET ""` / `GET "/"` 列表 + `MediaAssetOut`）

---

## 发现与说明

1. **媒体列表**：原路由仅有 `/{object_name:path}` 与 `download-url`；在 `download-url` 之前增加 `list_media_assets`，避免被通配路由吞掉。  
2. **时间线数据量**：当前 `limit=100`，页面已提示「需后续分页」。  
3. **Tag / PR**：计划中的 `mtc-C/*` 与 `Composer-coding → main` 的 PR 由 **Opus** 按组织规范执行，本实现不代打 tag。

---

## 与 D 子项目的接口

- 记忆、成员、档案、媒体下载 URL 与列表形态与当前 OpenAPI 行为一致；D 侧对话/故事书可按 `archive_id` / `member_id` 拉取上下文。  
- 记忆与媒体的强关联（按 memory 维度筛图）仍为 **E/C backlog**，未在本轮实现。

---

## 遗留 backlog

- Memory ↔ Media 关联表（E）  
- MediaUploader：拖拽、断点续传、秒传  
- `status` 扩展为 5 值（E 迁移 + 前端映射）  
- Timeline 分页 / 游标  
- MinIO 两阶段全链路 E2E（需可用 MinIO）

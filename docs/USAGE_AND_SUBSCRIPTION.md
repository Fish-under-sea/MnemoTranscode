# 用量、订阅档位与前端行为说明

本文档汇总 **订阅档位与限额真源**、**用量 REST 契约**、**个人中心 / 仪表盘与缓存**，以及近期与体验相关的 **前端实现注意点**（含对话页、全局 401）。实现细节以代码为准。

---

## 1. 后端：档位与上限真源

- **配置文件**：`backend/app/services/subscription.py`
  - **`TIER_TOKEN_LIMITS`**：`free` / `lite` / `pro` / `max` 的每月「订阅口径」tokens 上限。
  - **`TIER_STORAGE_QUOTA_BYTES`**：同档位的 **云存储配额（字节）**，随 `subscription_tier` 变化。
  - **`normalize_tier`**：`enterprise` 等 legacy 归入 `max` 等规范化逻辑。
  - **`tier_monthly_token_limit(user)`**：**月度订阅 tokens 上限仅以当前 `subscription_tier` 推导**，与产品页档位描述一致；避免库里 `monthly_token_limit` 与 tier 脱节导致展示错位。
  - **`apply_tier_to_user`**：切换档位时同时写入 `subscription_tier` 与 `monthly_token_limit`（与 canonical 对齐）。

- **受影响接口**：`GET /api/v1/usage/stats`、`GET /api/v1/usage/quota`、`POST /usage/subscription-tier`（及等价 `PATCH /auth/me` / 订阅路由）序列化时的 **`monthly_limit`** 均以档位为准。

- **存储已用量**：`GET /usage/stats` 中 `storage_used` 为 **`media_assets` 按 owner 聚合 size**；`storage_quota` 由 **`storage_quota_bytes_for_tier(tier)`** 得出。

详见 [API.md](./API.md) 第六节。

---

## 2. 前端：数据源与缓存

- **TanStack Query 键**：`['dashboard', 'usage']`，由 **`usageApi.getStats()`**（`GET /usage/stats`）拉取；**仪表盘「存储用量」**与 **个人中心概览**同源。
- **字节格式化**：`frontend/src/lib/formatBytes.ts`（`formatStoragePrimaryLine`、`storageProgressPercent` 等与后端字段对齐）。
- **令牌限额展示**：个人中心概览 **优先使用 `stats.monthly_limit`**，缺失时再回退到 auth store / `subscriptionTier.ts` 中 **`tierMonthlyTokenLimit`**（需与后端 `TIER_TOKEN_LIMITS` **数值保持一致**）。
- **上传完成后刷新用量**：上传成功回调中可对 **`['dashboard', 'usage']`** 调用 **`invalidateQueries`**（例如在成员相册 `MediaUploader` 的 `onComplete`）。

---

## 3. AI 对话（Web）：打字机与列表补水

- **协议**：当前 Web 仍为 **`POST /dialogue/chat` 一次返回完整 JSON**（含 `reply`）；**打字机仅为前端模拟**，非 SSE。
- **`useDialogue`**：`listMessages` 使用 **`refetchOnWindowFocus: true`**。当服务端列表在打字过程中被 **整表写入 `setMessages`** 时，**必须先 `stopTypewriter()`**（清 interval、`isTyping`、`displayedContent`），否则会长期用 **半截 `displayedContent`** 覆盖已为完整的 `msg.content`，表现为「截断 + 假光标」。实现见 `frontend/src/hooks/useDialogue.ts`。
- **`ChatBubble`**：**尾光标**仅在 **`showTypingCaret`**（父组件传入「正在逐字输出」）为真时渲染，避免与内容不同步时的误显。

---

## 4. 全局 HTTP 401

- **`frontend/src/services/api.ts`** 响应拦截：收到 **401** 时 **`clearAuth()`**，**不再使用 `window.location.href = '/'` 强制整页刷新**；未登录路由由 **`App.tsx`** 内 **`Navigate`** 切换，减少与 SPA 导航、并行请求的竞态（例如误触「像被登出」）。

---

## 5. 数据库迁移：多 head 与合并

若 **`alembic upgrade head`** 报错 **Multiple head revisions**，先用 **`alembic heads`** 查看所有 head，再 **`alembic merge <rev1> <rev2> -m "..."`** 生成空合并脚本，提交后重新部署。

本仓库曾合并 **`a1b2c3d4e5f7`**（对话消息表）与 **`f0a1b2c3d4e5`**（订阅档位数据修复）两条线，合并 revision 为 **`e3887247034b`**（见 `backend/alembic/versions/e3887247034b_merge_dialogue_and_subscription_heads.py`）。

---

## 6. Docker：重建后端镜像

- 脚本：`scripts/rebuild-backend-docker.ps1`（`--no-cache` 构建 **`backend`** + **`celery-worker`**，再 **`up -d`**）。
- Windows 建议使用 **`-NoProfile`**，并可 **`-DockerExePath`** 指向 Docker Desktop 的 `docker.exe`，避免 `$PROFILE` 或 PATH 把 `docker` 指到异常后端。详见 [stable-dev-windows.md](./stable-dev-windows.md)。

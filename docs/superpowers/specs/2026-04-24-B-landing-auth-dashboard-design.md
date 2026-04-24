# 子项目 B 设计文档 · 落地页 / 登录注册 / 仪表盘

> 版本：**v1.0（Opus 独立定稿）**
> 日期：2026-04-24
> 分支：`Opus-coding`（子项目主导 = Claude 4.7 Opus · A 轨设计 → 交付后 B 轨 Composer 2 批量落地）
> 规格上游：`.cursor/rules/mtc-refactor-roadmap.mdc` v1.5 · § 五.1 产品语言决议 · § 七 模型档位
> 前置条件：子项目 A（设计系统 + 动效基座）已完成；子项目 E（后端工程化 + 媒体服务）已完成
> 本文档定位：B 子项目 brainstorming 阶段产出的**设计规格**，不是实现计划（实现计划由 `writing-plans` 产出）

---

## § 0 · 用户授权声明与审查入口

本文档由 Opus 在用户明示授权（"直接按你推荐的最优方案设计，我不参与"）下独立完成。为守住 § 十.5「关键分歧暴露给用户」，**所有具有分歧的决策点都在 § 三 明确列出「备选方案 / 采纳理由 / 推翻成本」**，方便用户随时推翻。

审查入口：
- § 二 · 目标与非目标 — 确认工作范围
- § 三 · 核心架构决策 — 7 个决策点，推翻任一即可重开
- § 四 · § 五.1 产品语言改写清单 — 文案级最终稿
- § 九 · DoD 与验收 — 最终交付标准

---

## § 1 · 背景与范围

### 1.1 为什么要做 B

路线图 § 二 对 B 的定义是：**"前端经脉连通 · 落地页重构 + 登录/注册 + Dashboard 数据聚合 + react-bits 白名单接入 + 空/错/载态统一"**。

现状（2026-04-24 快照）：

| 页面 | 行数 | 问题 |
|---|---|---|
| `LandingPage.tsx` | 856 | 完全自实现动效 + 裸 Tailwind，**没用 A 基座**；有 4 处「逝者/逝去的亲人」产品语言预设违反 § 五.1 |
| `DashboardPage.tsx` | 138 | 真实薄壳，只显示档案数；缺记忆数/最近活动/用量 |
| `LoginPage.tsx` | 139 | 已较完善但用旧错误格式（`error.detail`）；未用 A 的 UI 组件 |
| `RegisterPage.tsx` | 160 | 同 LoginPage |
| `LoginModal.tsx` | 163 | 与 LoginPage 逻辑高度重复 |
| `services/api.ts` | 191 | axios 拦截器仅处理旧错误 envelope；`createMember` 仍用 `death_year` 未切到 E 的 `status`/`end_year` |

### 1.2 B 的范围（In Scope）

1. **LandingPage 重构**：原地迁移到 A 基座（motion/motionPresets/ScrollReveal + UI 组件）；分段入场节奏；文案去假设化
2. **Login/Register/LoginModal 收敛**：抽 `useAuthForm` 共享逻辑；UI 迁到 A 基座；保留三个入口
3. **Dashboard 数据聚合**：KPI 卡（档案数 + 记忆数 + 最近守护 + 存储用量）+ 最近记忆时间线 + 空/载态
4. **API 契约适配**：axios 响应拦截器支持 E 的新错误 envelope；`createMember`/`updateMember` 切到新字段；全站错误提示统一
5. **空/错/载态统一**：为 B 涉及页面建立统一的 `EmptyState` / `ErrorState` / `LoadingState` 三件套（延伸到 C/D）
6. **§ 五.1 产品语言改写**：LandingPage + Dashboard 所有"逝者/逝去的亲人"预设文案改写为双向语义

### 1.3 B 的非范围（Out of Scope）

**明确不做**（交给 C/D）：

- ❌ ArchiveListPage / ArchiveDetailPage / MemberDetailPage 重构（→ C）
- ❌ DialoguePage / TimelinePage / StoryBookPage（→ C/D）
- ❌ PersonalCenterPage / SettingsPage（→ D）
- ❌ 后端新增任何接口（E 已完结，B 只消费现有接口）
- ❌ 已完成的 A 基座扩展（不新增 UI 组件；确需新增组件在 B 末期以"B 扩展"子 commit 补充）
- ❌ Windows / Android 客户端

### 1.4 与 A、E 的契约边界

**依赖 A 提供**：
- `frontend/src/lib/motion.ts`：6 档 `motionPresets` + `fadeUp`/`fadeIn`/`scaleIn`/`staggerContainer`/`pageTransition` variants
- `frontend/src/components/ui/*`：Button / Card / Input / Textarea / Select / Modal / Drawer / Tabs / Dropdown / Toast / Skeleton / Badge / Avatar / ConfirmDialog / PageTransition / ScrollReveal
- `docs/design-system.md`：令牌 / 字阶 / 节奏哲学 / 禁止项

**依赖 E 提供**：
- `/api/v1/archives`（已含 `member_count` + `memory_count` 聚合）
- `/api/v1/memories`（支持 `archive_id` / `member_id` 过滤，支持 `skip`/`limit` 分页）
- `/api/v1/usage/stats`（用量统计）
- `/api/v1/usage/quota`（配额）
- 新错误 envelope：`{ error_code, message, fields?, request_id? }`
- `members.status` enum（`"alive" | "deceased" | "unknown"`）+ `members.end_year` 字段，Phase 0 兼容窗口：同时接收新旧字段
- `X-Request-ID` 响应头（用于日志排障）

**B 向 C 交付**：
- `useAuthForm` hook（Login/Register/LoginModal 共用）
- `EmptyState` / `ErrorState` / `LoadingState` 三件套（放到 `components/ui/state/`）
- `useApiError` hook（新 envelope 的统一解析 + toast 兜底）
- 前端 API types 对齐 E 新字段的完成状态

---

## § 2 · 目标与非目标

### 2.1 目标

1. **视觉一致性**：LandingPage / Login / Register / Dashboard 在设计语言上完全对齐 A 基座（色彩 / 字阶 / 阴影 / 圆角 / 动效节奏），不再有"自由发挥"
2. **产品语言安全**：B 涉及页面中所有对外文案通过 § 五.1 审查，不再预设单一场景（纪念逝者）
3. **数据驱动的 Dashboard**：用户登录后首屏能在 < 500ms 内看到真实数据聚合（除网络延迟）
4. **错误处理一致**：所有 API 调用错误走统一管道，新 envelope 的 `error_code` 驱动用户提示
5. **性能基线**：LandingPage 首屏 LCP < 2.5s（桌面）/ < 3.5s（移动 4G），Lighthouse Performance ≥ 85
6. **无障碍基线**：尊重 `prefers-reduced-motion`（A 基座已有兜底，B 不得退化）；键盘可达；主按钮有可见焦点环

### 2.2 非目标

1. ❌ 完美的 SEO 和社交卡（Meta / OG / Schema.org） — 留给 D 子项目做上线前优化
2. ❌ PWA / Service Worker / 离线缓存
3. ❌ 国际化（i18n）— 当期只做简中
4. ❌ A/B 测试 / 埋点
5. ❌ 暗色模式调优 — A 基座已给定暗色 tokens，B 沿用不做单独设计

---

## § 3 · 核心架构决策

以下 7 个决策是 B 子项目的架构脊柱。每个都附「备选方案 / 采纳理由 / 推翻成本」。

### 决策 1 · LandingPage 迁移策略：**原地重构 + 逐 section commit**

**备选方案**：

| 方案 | 优势 | 劣势 |
|---|---|---|
| A · 原地重构 + 逐 section commit（**采纳**） | 只有一份代码；符合 § 六 per-stage push；PR diff 清晰 | 中间态若强行 build 会有视觉不一致，但不会阻塞 dev |
| B · 建 `LandingPageV3.tsx` 并行替换 | 随时可一键回滚 | 两份代码同时维护，容易遗留 v2 残留；PR 量大 |
| C · 整页推倒重写 | 架构最干净 | 违反 § 四「优先改进现有代码」原则；易失手删情感锚点文案 |

**采纳理由**：
- LandingPage 当前视觉成果度较高（暖白 + 翠绿 + 浮动 orb + gradient-text），**情感锚点文案值得保留**（如引言的"阳光在江面碎成一万个夏天"、尾声的"曾在你的生命里留下过折痕的人"）
- 逐 section commit 恰好匹配 § 六「完成一个阶段就推送」硬约束
- A/B 测试需求缺席，不需要双版本并行

**推翻成本**：改为方案 B 的成本在于首次建文件 + 路由切换（约 30 分钟）。在 M3.1 开始前推翻都来得及。

---

### 决策 2 · 动效迁移范围：**全量迁移到 motion/motionPresets + ScrollReveal，自实现动效完全退役**

**备选方案**：

| 方案 | 劣势 |
|---|---|
| A · 全量迁移（**采纳**） | 迁移成本较高，需要每 section 重写入场逻辑 |
| B · 保留 `useScrollReveal` + `animate-on-scroll` 作为补充 | 两套动效系统并存，维护成本翻倍；违反 § 十 A 子项目的统一承诺 |

**采纳理由**：
- A 基座的 `motionPresets` 有明确的 6 档节奏哲学，自实现版本无此约束
- `useScrollReveal` 的 `IntersectionObserver` + `classList.add('visible')` 模式与 React 声明式理念矛盾
- 自实现版本**没有 `prefers-reduced-motion` 兜底** — 这是无障碍红线，必须修

**退役清单**：
- 删除 `LandingPage.tsx:101-119` 的 `useScrollReveal` hook
- 全量删除 `animate-on-scroll` CSS class 相关样式（在 globals.css / tailwind.config.ts 里对应搜索）
- 保留 `animate-blob` / `floating-orb` / `dot-grid-bg` CSS（这些是装饰级 pure-css，不走 motion）

**推翻成本**：极低。如发现 motion 体积过大或兼容性问题，可只在 B 范围页面退回到自实现版本，不影响其他页面。

---

### 决策 3 · Login / Register / LoginModal 三件套：**保留三入口 + 抽取 useAuthForm hook 共享逻辑 + UI 统一用 A 基座**

**备选方案**：

| 方案 | 劣势 |
|---|---|
| A · 三入口 + 共享 hook（**采纳**） | 代码略增（新增一个 hook 文件） |
| B · 删除 LoginModal，统一用 /login 跳转 | Landing CTA 体验下降（用户被拉离 Landing） |
| C · 删除 LoginPage，统一用 Modal + 路由 query | returnTo 场景复杂；深链接 SEO 不友好 |

**采纳理由**：
- **Landing 的快速登录**（Modal）和 **独立访问 `/login`**（Page）是两个正交场景，都有价值
- 三个入口的差异只是**外壳**（Modal 有 backdrop / Page 有浮动背景），**内核**（表单字段 + submit + setAuth + returnTo 解析）完全相同
- 抽出 `useAuthForm` 把内核归一，外壳保留各自特色

**useAuthForm 契约**（M2 产出）：

```ts
interface UseAuthFormOptions {
  mode: 'login' | 'register'
  onSuccess?: (user: User) => void   // 默认 navigate(returnTo)
  returnTo?: string                   // 默认从 useSearchParams 读
}

interface UseAuthFormReturn {
  email: string; setEmail: (v: string) => void
  password: string; setPassword: (v: string) => void
  username?: string; setUsername?: (v: string) => void  // register only
  confirmPassword?: string; setConfirmPassword?: (v: string) => void  // register only
  showPassword: boolean; togglePassword: () => void
  rememberMe?: boolean; setRememberMe?: (v: boolean) => void  // login only
  loading: boolean
  error: ApiError | null   // 新 envelope
  handleSubmit: (e: FormEvent) => Promise<void>
}
```

**推翻成本**：低。若决定删 Modal 或 Page 之一，删除对应外壳文件即可，hook 完全可复用。

---

### 决策 4 · Dashboard 数据聚合策略：**客户端多路并发聚合（不新增后端聚合接口）**

**备选方案**：

| 方案 | 劣势 |
|---|---|
| A · 客户端并发 `archiveApi.list()` + `usageApi.getStats()` + `memoryApi.list({limit: 10})`（**采纳**） | 3 次 HTTP 请求；客户端计算 KPI |
| B · 后端新增 `/api/v1/stats/dashboard` 聚合接口 | 违反 B 子项目非范围（不动后端）；E 已收尾不应回流 |
| C · GraphQL | 引入新基础设施，ROI 不匹配 |

**采纳理由**：
- 三个接口都已存在且稳定，并发下总延迟 ≈ 最慢单次延迟（通常 < 200ms）
- 避免后端改动，守住 E 的「已完结」状态
- `react-query` 自带请求去重 + 缓存，重复访问 Dashboard 不会发重复请求
- 未来若 KPI 维度增多、客户端计算压力上来，再升级到方案 B（届时是 D 子项目性能优化范畴）

**Dashboard 数据模型**（M4 产出）：

```ts
// hooks/useDashboardStats.ts
interface DashboardStats {
  archiveCount: number                // from archiveApi.list().length
  memoryCount: number                 // sum of archive.memory_count
  archivesByType: Record<string, number>  // { family: 3, friend: 1, ... }
  recentMemories: Memory[]            // memoryApi.list({ limit: 10 })
  lastActivityAt: string | null       // max(recentMemories.created_at) —— 最近一次守护
  storageUsage: { used: number; quota: number }  // from usageApi.getStats()
  aiUsage: { thisMonth: number; quota: number }  // from usageApi.getStats()
}
```

**KPI 四卡设计说明**：
B 不做"本月新增记忆数"这个 KPI —— 客户端仅能拿到最近 10 条记忆，若用户本月新增 > 10 条则计算失真；后端补 `created_after` 过滤器或聚合接口违反 B 非范围。替代为"最近守护"（距最近一条记忆的时间差，如"3 天前"），数据从 `recentMemories[0].created_at` 直接得到，稳定可靠、情感温度更高。

**推翻成本**：中。若用户量级上升（档案数 > 500），需升级到后端聚合接口，届时是一次完整 PR 的工作量。

---

### 决策 5 · 错误处理架构：**axios 响应拦截器适配新 envelope + useApiError hook + 全局 Toast 兜底**

**备选方案**：

| 方案 | 劣势 |
|---|---|
| A · 拦截器统一处理（**采纳**） | 需要同时兼容旧 `detail` 和新 envelope 两种格式（Phase 0 期间后端可能同时返回） |
| B · 每个调用处独立 try/catch | 代码重复 + 遗漏风险 |
| C · 只用新格式，不向后兼容 | 违反 E 的 Phase 0 兼容窗口；某些接口升级节奏不一致时会崩 |

**采纳理由**：
- E 的 Phase 0 窗口期（至 B 子项目末）必须双格式兼容
- 拦截器 + hook 是前端错误处理的标准模式，与 `react-query` 的 `onError` 协作良好
- `error_code` 驱动的文案映射集中在一处，未来国际化也在此处

**ApiError 契约**（M1 产出，对齐 E 实际后端产出格式）：

```ts
// services/errors.ts
export interface ApiError {
  error_code: string              // 如 "AUTH_UNAUTHORIZED" / "VALIDATION_FAILED" / "HTTP_400"
  message: string                 // 后端给的可读消息（E 的 auth.py 未迁 DomainError 前仍为中文 detail）
  fields?: string[]               // 出错的字段名数组（非 map），由 E 的 exception_handlers 产出
  request_id?: string             // 从 body.request_id 或 X-Request-ID header
  http_status: number             // 从 response.status 拷贝，前端分类用
}

// services/api.ts 响应拦截器（伪代码）
api.interceptors.response.use(
  (response) => response.data,
  (error: AxiosError) => {
    const data = error.response?.data as any
    const apiError: ApiError = {
      error_code: data?.error_code ?? inferFromStatus(error.response?.status),
      message: data?.message ?? data?.detail ?? '网络异常',  // 新优先，旧 detail 回落
      fields: Array.isArray(data?.fields) ? data.fields : undefined,
      request_id: data?.request_id ?? error.response?.headers['x-request-id'],
      http_status: error.response?.status ?? 0,
    }
    return Promise.reject(apiError)
  }
)

// hooks/useApiError.ts
export function useApiError() {
  return {
    show: (err: unknown, fallback = '操作失败') => {
      const apiErr = isApiError(err) ? err : null
      const msg = apiErr ? mapErrorToMessage(apiErr) : fallback
      toast.error(msg)
      if (apiErr?.request_id && import.meta.env.DEV) {
        console.warn('[request_id]', apiErr.request_id, apiErr.error_code)
      }
    },
    // 判断是否有字段错误（供表单高亮错误字段用）
    hasFieldError: (err: unknown, field: string) => {
      if (!isApiError(err)) return false
      return Array.isArray(err.fields) && err.fields.includes(field)
    },
  }
}
```

**`mapErrorToMessage` 策略**（兼顾 E 当前实际产出 + 未来迁移）：

E 目前 `exception_handlers.py` 对 HTTPException 的粗粒度兜底映射如下：

| E 实际产出 error_code | 触发位置 | 前端处理 |
|---|---|---|
| `AUTH_UNAUTHORIZED` | 401（auth.py 的 HTTPException + 未来 DomainAuthError 都落在这里）| 优先 passthrough `message`（后端已给中文），无 message 时回落"请先登录" |
| `AUTH_FORBIDDEN` | 403 | passthrough `message`，回落"无权限执行此操作" |
| `RESOURCE_NOT_FOUND` | 404 | passthrough `message`，回落"资源不存在" |
| `RESOURCE_CONFLICT` | 409 | passthrough `message` |
| `VALIDATION_FAILED` | 422 RequestValidationError | 若有 `fields`，拼接"「{fieldNames}」字段校验失败"；否则 passthrough `message` |
| `VALIDATION_METHOD_NOT_ALLOWED` | 405 | "请求方式不被允许"（罕见）|
| `RATE_LIMIT_EXCEEDED` | 429 | "请求过于频繁，请稍后再试" |
| `INTERNAL_SERVER_ERROR` | 500 / 未捕获 Exception | "服务暂时不可用，请稍后再试"（隐藏后端 traceback 痕迹） |
| `SERVICE_UNAVAILABLE` | 503 | "服务暂时不可用" |
| `HTTP_400` / `HTTP_4xx`（未在 STATUS_TO_CODE_FALLBACK 中的状态码）| 其他 | passthrough `message`，回落按 status 粗粒度 |
| `MEDIA_TTS_*`（来自 voice service）| E M6 相关 | B 不涉及，先 passthrough |
| 未识别 | — | passthrough `message` 或 fallback |

**核心原则**：后端已给可读中文 `message`（如 "该邮箱已被注册"/"邮箱或密码错误"）时，**优先 passthrough，不做前端覆盖**。前端覆盖仅用于：
1. 后端消息缺失/英文/技术性（如 "Unprocessable Entity"）
2. 需要结合 `fields` 生成更具体的表单级提示

这套策略的好处：
- 当前 auth.py 未迁 DomainError 也能得到可读提示（走 passthrough）
- 未来 E 或 C/D 把 auth.py 迁到 DomainError（比如改成 `DomainAuthError(error_code="AUTH_INVALID_CREDENTIALS", message="邮箱或密码错误")`），前端自动仍可读
- 不产生死代码（前端映射表只覆盖确定产出的 code）

**推翻成本**：低。如未来 error_code 增多，只需扩 `mapErrorToMessage` 白名单。

---

### 决策 6 · 空/错/载态三件套：**在 `components/ui/state/` 新建 `EmptyState` / `ErrorState` / `LoadingState`，供 B 及后续 C/D 复用**

**备选方案**：

| 方案 | 劣势 |
|---|---|
| A · 封装三个组件（**采纳**） | 需要新增 3 个文件（算 A 基座延伸） |
| B · 每页自己写 | 违反 § 二 B 要求「空/错/载态统一」 |

**采纳理由**：
- 是 § 二 B 的硬要求
- A 基座没涵盖这三件套（A 的 16 组件 MVP 不含），由 B 补齐是自然延伸
- 后续 C/D 所有页面都需要，是基础设施级组件

**三件套契约**：

```tsx
// components/ui/state/EmptyState.tsx
interface EmptyStateProps {
  icon?: LucideIcon       // 默认 Inbox
  title: string           // 如"还没有档案"
  description?: string    // 如"创建第一个档案来开始守护记忆"
  action?: { label: string; onClick: () => void; variant?: ButtonVariant }
  className?: string
}

// components/ui/state/ErrorState.tsx
interface ErrorStateProps {
  title?: string          // 默认"出了点问题"
  error?: ApiError | Error | string
  onRetry?: () => void
  className?: string
}

// components/ui/state/LoadingState.tsx
interface LoadingStateProps {
  variant?: 'spinner' | 'skeleton-cards' | 'skeleton-list'  // 默认 spinner
  message?: string
  className?: string
}
```

所有三件套：
- 走 `ScrollReveal` 入场动效（尊重 reduced-motion）
- 使用 A 基座的 `Button` / `Card` / `Skeleton`
- 文案做到**中文优先、双向语义**，不预设场景

**推翻成本**：极低。单组件级增删不影响其他结构。

---

### 决策 7 · react-bits 使用策略：**B 阶段零引入**

**备选方案**：

| 方案 | 劣势 |
|---|---|
| A · B 阶段零引入（**采纳**） | Landing 的"炫"分值略低（但情感基调够了） |
| B · 白名单引入 1-2 个（如 ShinyText、GradientText、MagneticButton） | 首次引入需评估 bundle 影响；风格风险 |

**采纳理由**：
- 路线图 § 九.2 明确要求「react-bits 白名单化 + 单页不超过 2 个」
- 当前 A 基座的 `motion` + 自写 `gradient-text-jade` class 已经能覆盖 Landing 的视觉需求
- Landing 的情感基调是**温润**，不是**炫技**，与 react-bits 多数效果不匹配
- **把 react-bits 的首次引入留给 C 子项目**（档案详情页「记忆回放」场景更契合：打字机效果 / 磁吸卡片 / 粒子流）

**推翻成本**：低。B 末期若体感不足，可单 PR 追加 1 个 react-bits 组件（如 Hero 主标题用 `ShinyText`）。

---

## § 4 · § 五.1 产品语言改写清单（B 范围内最终稿）

> 原则：**双向语义优先**（同时适用"健在的重要 ta"和"已离开的重要 ta"）。保留情感浓度，去除单一场景假设。

### 4.1 LandingPage.tsx

| 行号 | 原文案 | 改写为 | 理由 |
|---|---|---|---|
| 26 | `'LLM 自动总结、归类、时间线重建，让散落的记忆碎片有序排列'` | **保留** | 双向可用 |
| 32 | `'网页、微信、QQ 均可与逝去的亲人对话，声音+记忆还原真实的人'` | `'网页、微信、QQ 均可与重要的 ta 对话，声音+记忆还原真实的人'` | 去「逝去的亲人」预设 |
| 38 | `'可视化交互展示，按成员、年份、情感筛选，穿越时光找回记忆'` | **保留** | 双向 |
| 44 | `'一键生成生命故事，支持多种风格，让回忆变成永恒的文字'` | **保留** | 双向 |
| 50 | `'设定未来解封时间，定时推送，实现跨越时间的情感传承'` | **保留** | 双向 |
| 56 | `'用克隆的声音读出文字，让逝者的声音穿越时空再次响起'` | `'用克隆的声音读出文字，让珍贵的声音穿越时空再次响起'` | 去「逝者」预设 |
| 63 | `'终于能把爷爷的声音留下来了。那些教我下棋的午后、那些讲老故事的夜晚，都活过来了。'` | **保留** | 怀念口吻，未明说已逝；真实场景 |
| 69 | `'我把和奶奶的所有聊天记录都导入了，现在每天都能和她"对话"。她还是那么唠叨，那么温暖。'` | **保留** | 双向（奶奶健在 / 已逝均可读）|
| 75 | `'用 MTC 整理了外婆的一生，写成了故事书。家族里每个人都抢着要一本。'` | **改为非纪念型场景**：`'怀孕时把给孩子的信、胎心音、每天的日记都放进了 MTC。等 ta 长大，就打开给 ta 看。'` | 多样化：把一条从"回忆已逝"改为"记录当下 → 未来解封"，呼应"记忆胶囊"功能 |
| 91 | `{ label: '恋人记忆', desc: '两个人的珍贵时光', ... }` | **保留** | |
| 92 | `{ label: '挚友记忆', desc: '知交半生的情谊', ... }` | **保留** | |
| 93 | `{ label: '至亲记忆', desc: '血浓于水的牵挂', ... }` | **保留** | |
| 94 | `{ label: '伟人记忆', desc: '名留青史的风范', ... }` | **保留** | |
| 95 | `{ label: '国家历史', desc: '民族的共同记忆', ... }` | **保留**（但在 § 七 视觉上弱化为次级，避免喧宾夺主） | |
| 443 | `'用 AI 守护每一段珍贵的记忆'` | **保留** | 双向 |
| 449-453 | Hero 主标题："人的记忆是一种不讲道理的存储介质" | **保留** | 品牌标志，双向 |
| 458-464 | Hero 副标题 | **保留** | 双向 |
| 528-534 引言区 | "ta 会在某个瞬间表现出近乎完美的体贴..." + "阳光在江面碎成一万个夏天" | **保留** | 情感锚点，双向 |
| 549 | `'不只是存储，是传承'` | **保留** | 双向 |
| 570 | `'不只服务于家族'` | **保留** | 双向 |
| 604 | `'选择你的使用方式'` | **保留** | |
| 625 | `'将 MTC 的 AI 能力接入微信。在微信里直接和逝去的亲人对话，像以前一样聊天。支持私聊和群聊，自动记忆上下文。'` | `'将 MTC 的 AI 能力接入微信。在微信里直接和重要的 ta 对话，像以前一样聊天。支持私聊和群聊，自动记忆上下文。'` | 去「逝去的亲人」预设 |
| 650 | `'他们的故事'` | **保留** | |
| 653 | `'每一段记忆都值得被守护'` | **保留** | |
| 732 | `'每一个生命都值得被铭记'` | `'每一个值得的人都值得被铭记'` | **减弱挽歌预设**：原文案"每一个生命都值得被铭记"暗含全部记录的都是"已逝的生命"；改为"每一个值得的人"更开放，可以是在世的父母、孩子、爱人、自己 |
| 735-738 尾声主标题 | `'留下，只是一个具体的、真实的、曾在你的生命里留下过折痕的人。'` | **保留** | 品牌级情感锚点。"折痕"意象双向可用 |
| 740-743 | `'当这个项目运行结束，那些被神化或被模糊的轮廓终将消失。剩下的，是平凡而真实的 ta。'` | **保留** | 品牌级，双向 |
| 750 | `'开始守护记忆'` | **保留** | |
| 787 | `'© 2026 MTC — Memory To Code. 用 AI 守护每一段珍贵的记忆。'` | **保留** | |
| 805 | `'客户端即将发布'` | **保留** | |

### 4.2 DashboardPage.tsx

| 行号 | 原文案 | 改写为 | 理由 |
|---|---|---|---|
| 31 | `'欢迎回来'` | **动态化**：未登录 → "欢迎"；有用户名 → "{username}，欢迎回来"；空档案 → "开始你的第一段记忆" | 减少空壳感 |
| 32 | `'每一段记忆都值得被守护'` | **保留** | 双向 |
| 51 | `'与记忆对话'` | **保留** | |
| 69 | `'生成回忆录'` | `'生成生命故事'` | 与路线图 § 五.1 术语对齐（"生命故事档案"）|
| 106 | `'还没有任何档案'` | `'还没有任何档案 · 开始守护第一段记忆'` | 温度升级 |
| 113 | `'创建第一个档案'` | **保留** | |
| 129 | `'{archive.member_count} 成员 · {archive.memory_count} 条记忆'` | `'{archive.member_count} 位 ta · {archive.memory_count} 条记忆'` | "位 ta"更自然（人本关系）|

### 4.3 LoginPage.tsx / RegisterPage.tsx

| 行号 | 原文案 | 改写为 | 理由 |
|---|---|---|---|
| LoginPage:64 | `'欢迎回来'` | **保留** | |
| LoginPage:65 | `'登录到你的记忆银行'` | `'回到你守护的记忆里'` | "记忆银行"过金融术语；"守护"贯穿品牌语 |
| LoginPage:116 | `'记住我（7天免登录）'` | **保留** | |
| RegisterPage:62 | `'创建账号'` | **保留** | |
| RegisterPage:63 | `'开始守护你的珍贵记忆'` | **保留** | |

---

## § 5 · 执行顺序与 milestone

**总原则**：先修契约（M1），再做原子化页面（M2/M4），最后整页重构（M3），以 M5 收尾。每个 milestone 一个 commit + push（§ 六 per-stage push）。

```
M1 · API 契约适配 + 错误处理架构
  └─ 无页面视觉变化，为后续所有页面奠定错误处理基础
      ↓
M2 · Login / Register / LoginModal 统一
  └─ useAuthForm hook + UI 迁移；三入口逻辑收敛
      ↓
M4 · Dashboard 数据聚合
  └─ 注：不是 M3。Dashboard 数据聚合独立于 LandingPage 重构，可早做
      ↓
M3 · LandingPage 原地重构（最大头，分 3.1-3.9）
  └─ 9 个子 milestone，每个 section 一个 commit
      ↓
M5 · 收尾 · 文档 + tag + 类型守卫 + 冒烟测试
```

注：编号看起来乱（M1→M2→M4→M3→M5），但这是**实际执行的依赖序**，非编号序。之所以保留 M3 编号而不是顺序命名，是因为 LandingPage 本身就是 B 最大块工作量，值得保留"重头戏"的编号识别度。

### M1 · API 契约适配 + 错误处理架构

**交付**：
- `frontend/src/services/errors.ts`（新增）：`ApiError` interface + `isApiError` / `inferFromStatus` / `mapErrorToMessage` 工具
- `frontend/src/hooks/useApiError.ts`（新增）：`show(err)` + `getFieldError(err, field)`
- `frontend/src/services/api.ts`（修改）：
  - 响应拦截器适配新 envelope（保持旧 `detail` 回落）
  - `archiveApi.createMember` / `updateMember` 切到新字段 `status`/`end_year`（Phase 1 前端完成）
- 现有调用处**不动**（错误兼容已由拦截器接住）

**DoD**：
- `npm run type-check` 通过
- 人工触发一次登录失败，toast 显示"邮箱或密码错误"而非"Unauthorized"
- 触发一次档案创建成员，若传 `status: 'deceased'` 能正确创建
- 一个独立 commit：`feat(B): M1 · API 契约适配与错误处理架构`

### M2 · Login / Register / LoginModal 统一

**交付**：
- `frontend/src/hooks/useAuthForm.ts`（新增）：共享表单逻辑（见 § 三 决策 3）
- `frontend/src/pages/LoginPage.tsx`（重写）：用 `useAuthForm` + A 基座 `Input`/`Button`/`Card` 外壳保留浮动背景
- `frontend/src/pages/RegisterPage.tsx`（重写）：同上
- `frontend/src/components/LoginModal.tsx`（重写）：用 `useAuthForm` + A 基座 `Modal` 替换手写弹窗
- 文案按 § 四.3 改写

**DoD**：
- 三个入口均能正确登录 + 跳转 returnTo
- 错误提示通过 `useApiError` 呈现
- reduced-motion 下入场动效被禁用
- 一个独立 commit：`feat(B): M2 · 认证三件套统一 + useAuthForm hook`

### M4 · Dashboard 数据聚合（提前做，原因见上）

**交付**：
- `frontend/src/hooks/useDashboardStats.ts`（新增）：并发聚合 `archiveApi.list()` + `usageApi.getStats()` + `memoryApi.list({limit: 10})`
- `frontend/src/pages/DashboardPage.tsx`（重写）：
  - Header：欢迎语（动态） + 快捷创建按钮
  - KPI 四卡：档案数 / 记忆数 / 最近守护 / 存储用量（用 Card variant="plain" + Badge）
  - 档案类型分布（保留但用 Card + 数字动画）
  - 最近记忆条目（时间线式 10 条，ScrollReveal stagger）
  - 空态（0 档案 → EmptyState CTA "创建第一个档案"）
  - 错态（任一接口失败 → 部分 KPI 显示 ErrorState inline）
- `frontend/src/components/ui/state/EmptyState.tsx`（新增，在 M4 里一并建，供后续复用）
- `frontend/src/components/ui/state/ErrorState.tsx`（新增）
- `frontend/src/components/ui/state/LoadingState.tsx`（新增）

**DoD**：
- 登录后首次加载 Dashboard，能看到真实数据（不是硬编码）
- 断网情况下进入 Dashboard，整体页面可渲染（每个卡独立容错）
- KPI 数字有 `tabular-nums` 显示（§ 三.4 字阶规则）
- 两个独立 commits：
  - `feat(B): M4.1 · 空/错/载三件套组件`
  - `feat(B): M4.2 · Dashboard 数据聚合 + KPI 卡片`

### M3 · LandingPage 原地重构

按 section 分 9 个子 commit（§ 六 per-stage push）：

| 子 M | 范围 | 关键动作 |
|---|---|---|
| M3.1 | 骨架 + 浮动背景 | 移除 `useScrollReveal` hook；`animate-blob`/`floating-orb` 纯 CSS 保留；外层结构清理 |
| M3.2 | 导航栏 | 用 `Button` 替换手写按钮；移动端菜单用 `Drawer` 可选（或保留当前）|
| M3.3 | Hero | `ScrollReveal` 入场（stagger 标签 → 主标题 → 副标题 → CTA → STATS 统计）；CTA 用 `Button` variant="primary" size="lg" |
| M3.4 | 引言区 | 单个 `ScrollReveal direction="up" distance="16" cinematic` 包 blockquote |
| M3.5 | 功能展示 | `ScrollRevealGroup stagger={0.08}` 包 6 个 FeatureCard；FeatureCard 迁到 `Card` variant="plain" hoverable |
| M3.6 | 档案类型 | `ScrollRevealGroup` stagger；6 个类型卡保留当前配色但包 `Card` |
| M3.7 | 下载入口 | `DownloadCard` 迁到 `Card` variant="accent"；primary 卡保留 jade 渐变 |
| M3.8 | 用户故事 + § 四.1 文案改写 | 轮播逻辑不变，容器迁到 `Card` variant="glass"；TESTIMONIAL[2] 按 § 四.1 改写 |
| M3.9 | 尾声 CTA + 页脚 + 通用文案 sweep | 尾声 section 用 `ScrollReveal cinematic`；§ 四.1 其他逐行文案改写落盘 |

**DoD（每个 M3.x）**：
- 对应 section 在 reduced-motion 下动效禁用
- 桌面 + 移动端视觉不回退
- 一个独立 commit：`feat(B): M3.{x} · <section 名>`

**DoD（整个 M3）**：
- `npm run build` 通过
- Lighthouse Performance ≥ 85（桌面）
- 全页无 `animate-on-scroll` 残留

### M5 · 收尾

**交付**：
- 更新路线图 `.cursor/rules/mtc-refactor-roadmap.mdc` 至 v1.6：
  - 标记 B 完成
  - 新增 § 十三 · 子项目 B 完成摘要（参考 § 十一 A、§ 十二 E 的格式）
  - § 十.1 当前节点改为 "B 已完成，下一节点 C"
- 手动冒烟测试清单（至少 10 项）
- 打 annotated tag：`mtc-B/m5-opus`（主导）+ 若 Composer 2 有介入实现，额外打 `mtc-B/composer2-parts` 或通过 git notes
- PR 创建：`Opus-coding` → `main`（与 A 之前的合并方式一致）

**DoD**：
- `npm run build` 通过
- 所有 § 四 改写点落盘
- 路线图 v1.6 commit 到 `Opus-coding`
- tag 已推到 origin

---

## § 6 · LandingPage 重构详细方案

本节是 M3 的展开，作为实现阶段的参考蓝图。**不是任务清单，是设计蓝图**。

### 6.1 Hero 入场节奏（M3.3）

原则：**渐进揭开，模拟用户视线从上往下**。

```
[t=0ms]   Badge 标签     → fadeUp (confident)
[t=80ms]  主标题行 1     → fadeUp (confident)
[t=160ms] 主标题行 2     → fadeUp + gradient-text 的色彩浮现 (cinematic)
[t=240ms] 主标题行 3     → fadeUp (confident)
[t=320ms] 副标题 1        → fadeUp (gentle)
[t=400ms] 副标题 2        → fadeUp (gentle)
[t=480ms] CTA 按钮组      → fadeUp (confident)
[t=560ms] STATS 统计      → staggerChildren 0.06 (confident each)
```

实现：用 `staggerContainer(0.08)` 外层包裹，每行内容用 `fadeUp` 变体。总耗时约 800ms（达到 § 三.5.2 "cinematic" 的 600ms 内主要内容完成）。

### 6.2 功能展示 stagger（M3.5）

```tsx
<ScrollRevealGroup stagger={0.08} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
  {FEATURES.map((feature) => (
    <motion.div key={feature.title} variants={fadeUp}>
      <FeatureCard {...feature} />
    </motion.div>
  ))}
</ScrollRevealGroup>
```

### 6.3 浮动装饰背景（M3.1 保留 pure-css）

以下 CSS 类保留，不迁到 motion：
- `.floating-orb` / `.animate-blob`（装饰级长周期动画，用 CSS `@keyframes` 更高效）
- `.dot-grid-bg`（静态 SVG 背景）
- `.gradient-text-jade`（纯文字渐变，与 motion 无关）

理由：这些是**长周期循环动画**，不是"入场/退场/交互"动效，用 motion 反而增加 JS 开销。

但必须确保：
- `@media (prefers-reduced-motion: reduce) { .animate-blob { animation: none; } }`（在 globals.css 补上，如果还没有）

### 6.4 响应式断点

沿用 A 基座设定（tailwind 默认）：
- `sm` = 640px
- `md` = 768px
- `lg` = 1024px
- `xl` = 1280px

Hero 主标题字号策略：
- mobile：`text-5xl`（≈ 48px）
- sm：`text-6xl`（≈ 60px）
- lg：`text-7xl`（≈ 72px）

落地后用 Lighthouse 检查 CLS（布局偏移）应 < 0.1。

---

## § 7 · Login / Register 统一方案（M2）

### 7.1 useAuthForm 伪代码

```ts
// hooks/useAuthForm.ts
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '@/services/api'
import { useAuthStore } from '@/hooks/useAuthStore'
import { useApiError } from './useApiError'
import toast from 'react-hot-toast'

export function useAuthForm(mode: 'login' | 'register') {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const [searchParams] = useSearchParams()
  const { setAuth } = useAuthStore()
  const apiError = useApiError()
  const returnTo = searchParams.get('returnTo') || '/dashboard'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError(null)

    if (mode === 'register' && password !== confirmPassword) {
      toast.error('两次输入的密码不一致')
      return
    }

    setLoading(true)
    try {
      const response = mode === 'login'
        ? await authApi.login(email, password)
        : await authApi.register({ username, email, password })

      if (!response?.access_token || !response?.user) {
        throw new Error('响应格式异常')
      }

      if (mode === 'login' && rememberMe) {
        localStorage.setItem('mtc-remember', 'true')
      }

      setAuth(response.access_token, response.user)
      toast.success(mode === 'login' ? '登录成功' : '注册成功')

      const target = returnTo.startsWith('/') ? returnTo : '/dashboard'
      window.location.href = target
    } catch (err) {
      if (isApiError(err)) setError(err)
      apiError.show(err, mode === 'login' ? '登录失败' : '注册失败')
    } finally {
      setLoading(false)
    }
  }

  return {
    email, setEmail, password, setPassword,
    username, setUsername, confirmPassword, setConfirmPassword,
    showPassword, togglePassword: () => setShowPassword((v) => !v),
    showConfirm, toggleConfirm: () => setShowConfirm((v) => !v),
    rememberMe, setRememberMe,
    loading, error, handleSubmit,
  }
}
```

### 7.2 三个外壳差异

| 特征 | LoginPage | RegisterPage | LoginModal |
|---|---|---|---|
| 容器 | 全屏居中 `<div class="min-h-screen">` + floating-orb | 同 LoginPage | `<Modal size="md">` |
| 表单 Card | `<Card variant="glass" padding="lg">` | 同 | 同 |
| 标题 | "欢迎回来" + "回到你守护的记忆里" | "创建账号" + "开始守护你的珍贵记忆" | "登录" + "继续守护你的记忆" |
| 字段 | email / password / rememberMe | username / email / password / confirmPassword | email / password |
| 尾链接 | "还没有账号 → 立即注册" | "已有账号 → 立即登录" | "创建账号" 触发跳转 /register |

### 7.3 动效

- 容器入场：`fadeUp` 300ms
- 表单 Card 内部输入框：`staggerContainer(0.04)` + `fadeUp`
- 错误提示（有 `error` 时）：`fadeIn`

---

## § 8 · Dashboard 数据聚合方案（M4）

### 8.1 数据流

```
┌───────────────────────────────────────────────────────────┐
│                   DashboardPage                           │
│  ┌──────────────────────────────────────────────────┐     │
│  │  useDashboardStats() (react-query)               │     │
│  │  ┌───────────────┬─────────────┬──────────────┐  │     │
│  │  │ archives      │ memories    │ usage        │  │     │
│  │  │ /archives     │ /memories   │ /usage/stats │  │     │
│  │  │ (count+type)  │ (latest 10) │ (storage+ai) │  │     │
│  │  └───────────────┴─────────────┴──────────────┘  │     │
│  └──────────────────────────────────────────────────┘     │
│                           ↓                               │
│  ┌──────────────────────────────────────────────────┐     │
│  │  UI Layout                                       │     │
│  │  · 欢迎区（动态）                                 │     │
│  │  · KPI 四卡（并排）                               │     │
│  │  · 档案类型分布（6 胶囊柱状）                      │     │
│  │  · 最近记忆时间线（stagger）                       │     │
│  │  · 空态 / 错态（条件分支）                         │     │
│  └──────────────────────────────────────────────────┘     │
└───────────────────────────────────────────────────────────┘
```

### 8.2 useDashboardStats hook

```ts
// hooks/useDashboardStats.ts
import { useQuery } from '@tanstack/react-query'
import { archiveApi, memoryApi, usageApi } from '@/services/api'

export function useDashboardStats() {
  const archives = useQuery({
    queryKey: ['dashboard', 'archives'],
    queryFn: () => archiveApi.list(),
    staleTime: 30_000,
  })

  const recentMemories = useQuery({
    queryKey: ['dashboard', 'recent-memories'],
    queryFn: () => memoryApi.list({ limit: 10 }),
    staleTime: 30_000,
  })

  const usage = useQuery({
    queryKey: ['dashboard', 'usage'],
    queryFn: () => usageApi.getStats(),
    staleTime: 60_000,
  })

  return {
    archives: archives.data ?? [],
    recentMemories: recentMemories.data ?? [],
    usage: usage.data,
    isLoading: archives.isLoading || recentMemories.isLoading || usage.isLoading,
    errors: {
      archives: archives.error,
      recentMemories: recentMemories.error,
      usage: usage.error,
    },
    refetchAll: () => {
      archives.refetch()
      recentMemories.refetch()
      usage.refetch()
    },
  }
}
```

### 8.3 KPI 四卡

| 卡片 | 数据源 | 计算 | 为什么这么选 |
|---|---|---|---|
| 档案数 | `archives.length` | 直接 | 基础指标 |
| 记忆数 | `sum(archives.map(a => a.memory_count))` | 档案层聚合 | E 已在 archive response 聚合，无需额外请求 |
| 最近守护 | `recentMemories[0]?.created_at` → dayjs().fromNow() | "3 天前 / 刚刚 / 2 小时前" | 替代"本月新增"（见 § 三 决策 4 说明）；强化"持续守护"情感温度 |
| 存储用量 | `usage.storage_used / usage.storage_quota` | 比例 + 进度条 | 让用户感知媒体上传后的存储消耗，呼应 E 的 MinIO 私有桶 |

### 8.4 空态决策树

```
if (archives.length === 0):
  显示 EmptyState
    title="开始你的第一段记忆"
    description="创建一个档案，把想守护的关系安顿进来"
    action={{ label: "创建档案", onClick: () => navigate('/archives?new=1') }}
else:
  正常渲染所有卡片
```

### 8.5 错态决策树

- 任一 query failure：该卡独立显示 `<ErrorState size="sm" onRetry={refetch}>`
- 全部 failure：页面顶部显示 toast "部分数据加载失败" + 保留已成功的部分

---

## § 9 · DoD 与验收

### 9.1 功能 DoD

- [ ] Landing 所有 section 迁移完成，无 `animate-on-scroll` 残留，使用 A 基座 motion
- [ ] Landing 所有 § 四.1 指定文案改写落盘
- [ ] Login/Register/LoginModal 使用共享 `useAuthForm` hook，UI 一致
- [ ] Dashboard 显示真实聚合数据（四卡 + 最近记忆）
- [ ] 所有 API 错误通过 `useApiError` 统一呈现
- [ ] `EmptyState` / `ErrorState` / `LoadingState` 三件套落盘到 `components/ui/state/`
- [ ] `createMember` / `updateMember` 使用新字段 `status` + `end_year`

### 9.2 工程 DoD

- [ ] `npm run type-check` 通过（允许既有 baseline errors 不增加）
- [ ] `npm run build` 通过
- [ ] Lighthouse Performance ≥ 85（桌面，Landing 页）
- [ ] Lighthouse Accessibility ≥ 95
- [ ] Bundle 总 gzip 增量 ≤ 30 KB（B 主要是重构，不引入大依赖）
- [ ] 所有动效在 `prefers-reduced-motion: reduce` 下被禁用

### 9.3 产品语言 DoD

- [ ] Landing 页通篇阅读：健在/已逝两种场景都自然
- [ ] 至少 1 条 TESTIMONIAL 是"记录在世关系"
- [ ] Dashboard 文案 "成员" → "位 ta" 已改写

### 9.4 Git / 流程 DoD

- [ ] 每个 milestone 一个 commit（§ 六 per-stage push）
- [ ] 所有 commit 在 `Opus-coding` 分支
- [ ] 若有 Composer 2 辅助实现，用 git notes 标 `actual-model: composer-2`
- [ ] `mtc-B/m5-opus` annotated tag 推到 origin
- [ ] 创建 `Opus-coding` → `main` PR

---

## § 10 · 风险与回滚

### 10.1 风险矩阵

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| motion 库与 React 18 SSR 不兼容 | 低 | 中 | 当前项目是 CSR（Vite），不涉及 SSR |
| Lighthouse Performance 掉分 | 中 | 低 | 保留 `prefers-reduced-motion` 兜底 + CSS 装饰类不走 JS |
| axios 拦截器改动破坏其他页面 | 中 | 高 | 保留旧 `detail` 回落；引入前 grep 所有 `error.detail` 使用点 |
| `useDashboardStats` 三路并发超时 | 低 | 中 | react-query 5s 超时 + 单卡 ErrorState 独立容错 |
| LandingPage 原地重构中间态影响 dev 体验 | 高 | 低 | 每个 section commit push 后 `npm run dev` 自测 |
| 产品语言改写引发语气偏差 | 低 | 中 | § 四.1 清单已逐行标注保留/改写理由；保留品牌级情感锚点 |

### 10.2 回滚策略

- **单 section 回滚**：`git revert <commit>`，不影响其他 section
- **M1 契约适配整体回滚**：`git revert` + 保留旧拦截器，错误走 `error.detail` 兜底
- **整个 B 回滚**：不合并 `Opus-coding` → `main` PR；`main` 保持 E 收尾状态

---

## § 11 · 与后续子项目的契约

### 11.1 B → C（档案/成员/记忆页面）

B 交付物被 C 依赖：

- **`useAuthForm`**：若 C 有任何需要登录校验的跳转，直接复用
- **`useApiError`**：C 所有 API 调用走此 hook 兜底
- **`EmptyState` / `ErrorState` / `LoadingState`**：C 每个页面必用
- **API types**：B 末期已切到新字段，C 不需要再做兼容
- **error_code 白名单**：C 新用到的 code 扩 `mapErrorToMessage`

### 11.2 B → D（设置/个人中心/快捷操作）

- **`useDashboardStats` 模式**：D 的设置页 / 个人中心的数据聚合 hook 可套用
- **Card 变体使用约定**：D 沿用 B 对 `plain`/`glass`/`accent` 的语义分配

---

## § 12 · 附录

### 12.1 关键文件清单

**新增**：
- `frontend/src/services/errors.ts`
- `frontend/src/hooks/useApiError.ts`
- `frontend/src/hooks/useAuthForm.ts`
- `frontend/src/hooks/useDashboardStats.ts`
- `frontend/src/components/ui/state/EmptyState.tsx`
- `frontend/src/components/ui/state/ErrorState.tsx`
- `frontend/src/components/ui/state/LoadingState.tsx`
- `frontend/src/components/ui/state/index.ts`（barrel）

**修改**：
- `frontend/src/services/api.ts`（拦截器 + createMember 新字段）
- `frontend/src/pages/LandingPage.tsx`（全量重构 + 文案改写）
- `frontend/src/pages/DashboardPage.tsx`（全量重写）
- `frontend/src/pages/LoginPage.tsx`（用 useAuthForm）
- `frontend/src/pages/RegisterPage.tsx`（用 useAuthForm）
- `frontend/src/components/LoginModal.tsx`（用 useAuthForm）

**可能微修**：
- `frontend/src/index.css`（若发现 `animate-on-scroll` 残留样式需清理，或 `prefers-reduced-motion` 兜底需补）
- `frontend/src/components/ui/index.ts`（barrel 新增 state 导出）

### 12.2 B 涉及的 error_code 处理清单（对齐 E 实际产出）

详细策略见 § 3 决策 5。此处只列 B 范围内会遇到的 error_code：

| error_code（E 实际产出） | HTTP status | 前端处理 |
|---|---|---|
| `AUTH_UNAUTHORIZED` | 401 | passthrough `message`（后端 auth.py 已给"邮箱或密码错误"等中文 detail），回落"请先登录" |
| `AUTH_FORBIDDEN` | 403 | passthrough `message`，回落"无权限执行此操作" |
| `RESOURCE_NOT_FOUND` | 404 | passthrough `message`，回落"资源不存在" |
| `RESOURCE_CONFLICT` | 409 | passthrough `message` |
| `VALIDATION_FAILED` | 422 | 若有 `fields: string[]`，拼接"「{fields.join('、')}」校验失败"；否则 passthrough |
| `RATE_LIMIT_EXCEEDED` | 429 | "请求过于频繁，请稍后再试" |
| `INTERNAL_SERVER_ERROR` | 500 | "服务暂时不可用，请稍后再试"（不 passthrough，隐藏技术细节） |
| `SERVICE_UNAVAILABLE` | 503 | "服务暂时不可用" |
| `HTTP_400`（或其他 `HTTP_4xx`）| 其他 4xx | passthrough `message`，B 会用到（如注册时的"该邮箱已被注册"正是从 auth.py HTTPException(400) 来）|
| 未列出的 | — | passthrough `message` 或 fallback |

**不在白名单里的 code（如 `AUTH_INVALID_CREDENTIALS` / `AUTH_EMAIL_TAKEN` / `AUTH_TOKEN_EXPIRED`）不做映射**，因为 E 当前 `auth.py` 尚未迁到 DomainAuthError，这些细粒度 code 不产出。待 C/D 子项目把 auth.py 迁完后再按需补映射 — 届时 passthrough 策略仍然可读，不会导致 B 代码废弃。

### 12.3 motion 使用速查

| 场景 | variants | preset |
|---|---|---|
| 卡片进场 | `fadeUp` | `confident` |
| 列表 stagger 父 | `staggerContainer(0.08)` | — |
| 列表 stagger 子 | `fadeUp` | `confident` |
| 模态进场 | `scaleIn` | `confident` |
| Drawer 侧滑 | `slideRight` / `slideLeft` | `confident` |
| 路由切换 | `pageTransition` | `pageEnter` / `pageExit` |
| 大 section 揭幕 | `fadeUp` + `transition={motionPresets.cinematic}` | `cinematic` |
| 按钮 hover 颜色 | Tailwind class transition | — |

### 12.4 模型归属声明

- **本文档（spec）**：Claude 4.7 Opus · 独立完成（用户授权"不参与设计讨论"）
- **计划（plan）**：待 `writing-plans` 阶段产出，届时仍为 Opus
- **实现（impl）**：
  - M1 / M2 / M4 / M5：Opus 或 Composer 2（用户决定）
  - M3 各 section：Opus 或 Composer 2
  - 原则：**涉及"定调"和"从零建立动效节奏"由 Opus 做；纯 UI 迁移（类名替换、组件替换）可由 Composer 2 做**

### 12.5 超出 B 范围的观察（给 C/D 留存）

实际重构中发现但 B 不处理的问题，归档于此防遗忘：

1. **`globals.css` 可能有冗余** — `@fontsource` 导入策略在 A 已识别为 M6 优化点，D 末期处理
2. **`LandingPage` 的 `ChevronRight size={20} className="rotate-270"`** — Tailwind 没有 `rotate-270` 类（原代码 bug，被浏览器忽略）；B M3.3 顺手改为 `rotate-90` 或移除
3. **`PersonalCenterPage` 973 行** — 超出 A/B/C/D 任何一个子项目单文件上限，D 时必须拆分
4. **E 的 `X-Request-ID`** — B 的 `useApiError` 已捕获并在 dev 下 console.warn，生产环境上报到 Sentry 等服务属 D 范畴

---

**文档结束**。提交到 `Opus-coding` 分支后，下一步为 `writing-plans` 技能：产出详细实现计划（任务分解 / 每任务 DoD / 测试步骤 / 每任务预估时长）。

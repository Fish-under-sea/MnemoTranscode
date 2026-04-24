# 子项目 B 实现计划 · 落地页 / 登录注册 / 仪表盘

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在 A 设计系统 + E 后端工程化的基础上，重构前端 LandingPage / 登录注册 / Dashboard 三大场景，统一视觉语言 / 动效 / 错误处理 / 空错载态，完成 §五.1 产品语言改写与 E 契约对齐。

**架构：** 原地重构 + 逐 section commit（§ 六 per-stage push）。新增 4 个纯逻辑文件（`errors.ts` / `useApiError.ts` / `useAuthForm.ts` / `useDashboardStats.ts`）+ 3 个状态组件（`EmptyState` / `ErrorState` / `LoadingState`）+ 5 个 page/component 就地重写。完全复用 A 的 `motion` 基座与 UI 组件，react-bits 零引入。

**技术栈：** React 18 · TypeScript 5.4 · Vite 5 · Tailwind 3.4 · motion 12（Framer Motion）· axios 1.6 · react-query 5 · react-router 6 · zustand 4 · react-hot-toast 2 · dayjs 1.11 · lucide-react

**上游规格：** `docs/superpowers/specs/2026-04-24-B-landing-auth-dashboard-design.md`（v1.0 · Opus 定稿）

---

## § 0 · 工作模式声明（必读）

### 0.1 测试策略 · 务实适配

前端**当前无测试框架**（package.json 无 vitest/jest/RTL）。按 YAGNI + spec § 1.3 非范围（不扩基础设施），本计划**不引入测试框架**。替代方案：

| 类型 | 验证策略 |
|---|---|
| 纯函数（如 `mapErrorToMessage` / `inferFromStatus` / `formatLastActivity`） | 提供**输入-输出表**，在浏览器 DevTools 控制台或临时脚本校验；如实现时刻确定长期保留，可在 `src/**/*.check.ts` 写断言脚本（`node --loader tsx ...` 执行） |
| Hooks（`useApiError` / `useAuthForm` / `useDashboardStats`） | 通过**接入页面的手工冒烟清单**验证行为（每任务最后步骤） |
| UI 组件 / Pages | **手工冒烟清单**（每任务列出需要点击的操作、预期呈现、边界条件） |
| 全量回归 | `npm run type-check` + `npm run build` 作为门禁 + 每 milestone 末尾 **5 分钟手工冒烟全流程** |

为什么不引入 vitest：
- B 大部分工作是**视觉重构**，RTL 测不到视觉保真度
- 引入 vitest 会使 B 范围膨胀、影响交付节奏
- D 子项目（工程化收尾）才是引入测试框架的合适节点

### 0.2 颗粒度约定

writing-plans skill 推荐 "每步 2-5 分钟 / 一个操作"。对 B 子项目做如下适配：

- **纯逻辑文件**（errors.ts / hooks）→ 严格按 skill 要求，分步骤：写骨架 → 写每个导出 → 手工校验 → commit
- **UI 迁移任务**（LandingPage 各 section）→ 每 section 一个 task，内部列"变更项清单 + 关键代码片段 + 冒烟步骤"，**不逐行展开**（否则文档爆炸）

### 0.3 commit 纪律

- 每个 task 结束 = 一个 commit（§ 六 per-stage push 硬约束）
- commit message 用 `feat(B): M{x}.{y} · <简要描述>` 或 `refactor(B): ...` / `docs(B): ...`
- 每 milestone 结束（M1/M2/M4/M3/M5）= 推一次到 `origin/Opus-coding`
- **禁止**在 `main` 分支直接 commit；若误上 main 立即 `git reset --soft HEAD~N`

### 0.4 执行顺序

按设计 spec § 5：**M1 → M2 → M4 → M3 → M5**（非顺序编号，按依赖序）。理由：
- M1 契约适配不改 UI，风险最低
- M2 / M4 独立，Dashboard 数据聚合不需要 LandingPage 动效基础
- M3 是最大块 UI 重构，放最后积累的重构习惯+最高质量

---

## § 1 · 文件结构与职责（锁定分解）

### 1.1 新增文件（B 交付）

| 文件 | 职责 | 约束 |
|---|---|---|
| `frontend/src/services/errors.ts` | 定义 `ApiError` 接口 + `isApiError` 守卫 + `inferFromStatus`（HTTP → error_code 回落）+ `mapErrorToMessage`（error_code → 用户可读中文） | **纯函数**，零副作用；所有逻辑在输入-输出层可推理 |
| `frontend/src/hooks/useApiError.ts` | 供 UI 层消费的 hook：`show(err, fallback)` + `hasFieldError(err, field)` | 唯一副作用是调用 `toast.error` + `console.warn`（dev） |
| `frontend/src/hooks/useAuthForm.ts` | Login / Register 共享的表单状态 + submit 逻辑 | 不 import LoginPage/RegisterPage（避免循环）；mode='login'\|'register' 切换字段 |
| `frontend/src/hooks/useDashboardStats.ts` | Dashboard 三路并发数据聚合（react-query） | 不负责渲染；只返回 `{ data, loading, errors, refetchAll }` |
| `frontend/src/components/ui/state/EmptyState.tsx` | 空态容器：icon + title + description + action | 用 `Card` + `Button`；`ScrollReveal` 入场 |
| `frontend/src/components/ui/state/ErrorState.tsx` | 错态容器：错误图标 + title + description + retry 按钮 | 接受 `ApiError \| Error \| string`，自动解析 |
| `frontend/src/components/ui/state/LoadingState.tsx` | 载态容器：三 variant（spinner / skeleton-cards / skeleton-list） | 用 A 的 `Skeleton` 组件 |
| `frontend/src/components/ui/state/index.ts` | barrel 导出 | `export { EmptyState } from './EmptyState'` 等 |

### 1.2 修改文件

| 文件 | 修改要点 | 风险 |
|---|---|---|
| `frontend/src/services/api.ts` | 拦截器重写（兼容新 envelope + 旧 detail）；`createMember`/`updateMember` 字段签名切到 `status`+`end_year` | 中：涉及全站 API 调用，需验证不破坏现有页面 |
| `frontend/src/pages/LoginPage.tsx` | 重写：用 `useAuthForm` + A 基座 UI | 低 |
| `frontend/src/pages/RegisterPage.tsx` | 重写：同上 | 低 |
| `frontend/src/components/LoginModal.tsx` | 重写：用 `useAuthForm` + A 基座 `Modal` | 低 |
| `frontend/src/pages/DashboardPage.tsx` | 全量重写 | 低 |
| `frontend/src/pages/LandingPage.tsx` | 分 9 个 section 原地迁移；文案按 § 4.1 改写；移除 `useScrollReveal` hook | 中：文件大（856 行），每 section 需单独冒烟 |

### 1.3 可能微修（视需要）

- `frontend/src/index.css` 或 `frontend/tailwind.config.ts`：若发现 `animate-on-scroll` 残留 CSS 类，清理；若 `prefers-reduced-motion` 兜底缺失，补上
- `frontend/src/components/ui/index.ts`：新增 state 三件套的 barrel 导出

### 1.4 不修改文件（B 范围外）

- 任何 `backend/` 下的文件（E 已完结）
- `frontend/src/lib/motion.ts`（A 基座，B 仅消费）
- `frontend/src/components/ui/{Button,Card,Input,...}.tsx`（A 基座）
- 路由 `frontend/src/App.tsx`（除非 M4 Dashboard 改变路由结构，但 spec 未要求）

---

## § 2 · Milestone 与任务总览

| Milestone | 任务 | 预估时长 | 分支操作 |
|---|---|---|---|
| **M1** · API 契约适配 | Task 1-6 | 3-4 h | commit + push |
| **M2** · 认证三件套统一 | Task 7-10 | 3-4 h | commit + push |
| **M4** · Dashboard 数据聚合 | Task 11-14 | 4-5 h | commit + push |
| **M3** · LandingPage 重构 | Task 15-23 | 6-8 h | 每 section commit + 每 3 section push |
| **M5** · 收尾与交付 | Task 24-26 | 1.5 h | tag + PR |
| **合计** | 26 任务 | **17-21 h** | |

---

# Milestone 1 · API 契约适配 + 错误处理架构

---

### 任务 1 · 创建 `services/errors.ts`

**文件：**
- 创建：`frontend/src/services/errors.ts`

- [ ] **步骤 1 · 创建文件并定义 `ApiError` 接口与 `isApiError` 守卫**

```ts
// frontend/src/services/errors.ts

/**
 * 后端错误响应的标准信封（对齐 E middleware/exception_handlers）。
 *
 * E 产出的结构：
 *   {
 *     error_code: "AUTH_UNAUTHORIZED" | "VALIDATION_FAILED" | "HTTP_400" | ...,
 *     message: string,          // 后端中文可读消息
 *     fields?: string[],        // 出错字段名数组（VALIDATION_FAILED 时）
 *     request_id?: string       // 排障用
 *   }
 *
 * B 侧扩展 http_status 便于前端分类。
 */
export interface ApiError {
  error_code: string
  message: string
  fields?: string[]
  request_id?: string
  http_status: number
}

export function isApiError(value: unknown): value is ApiError {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.error_code === 'string' && typeof v.message === 'string' && typeof v.http_status === 'number'
}
```

- [ ] **步骤 2 · 追加 `inferFromStatus`（HTTP status → 兜底 error_code）**

对齐 E 的 `STATUS_TO_CODE_FALLBACK` 映射（`backend/app/api/middleware/exception_handlers.py:15-25`）。

```ts
// 续 frontend/src/services/errors.ts

const STATUS_TO_CODE_FALLBACK: Record<number, string> = {
  400: 'HTTP_400',
  401: 'AUTH_UNAUTHORIZED',
  403: 'AUTH_FORBIDDEN',
  404: 'RESOURCE_NOT_FOUND',
  405: 'VALIDATION_METHOD_NOT_ALLOWED',
  409: 'RESOURCE_CONFLICT',
  422: 'VALIDATION_FAILED',
  429: 'RATE_LIMIT_EXCEEDED',
  500: 'INTERNAL_SERVER_ERROR',
  503: 'SERVICE_UNAVAILABLE',
}

export function inferFromStatus(status: number | undefined): string {
  if (status === undefined || status === 0) return 'NETWORK_ERROR'
  return STATUS_TO_CODE_FALLBACK[status] ?? `HTTP_${status}`
}
```

- [ ] **步骤 3 · 追加 `mapErrorToMessage`（error_code + message → 用户消息）**

策略：后端 message 可读时 passthrough；code 有明确语义且后端未给消息时用白名单。详见 spec § 3 决策 5。

```ts
// 续 frontend/src/services/errors.ts

const WHITELIST_FALLBACK: Record<string, string> = {
  AUTH_UNAUTHORIZED: '请先登录',
  AUTH_FORBIDDEN: '无权限执行此操作',
  RESOURCE_NOT_FOUND: '资源不存在',
  RESOURCE_CONFLICT: '资源冲突，请刷新后重试',
  VALIDATION_METHOD_NOT_ALLOWED: '请求方式不被允许',
  RATE_LIMIT_EXCEEDED: '请求过于频繁，请稍后再试',
  INTERNAL_SERVER_ERROR: '服务暂时不可用，请稍后再试',
  SERVICE_UNAVAILABLE: '服务暂时不可用，请稍后再试',
  NETWORK_ERROR: '网络连接异常，请检查网络',
}

// 内部错误的 message 不 passthrough（隐藏后端技术细节）
const FORCE_FALLBACK_CODES = new Set(['INTERNAL_SERVER_ERROR', 'SERVICE_UNAVAILABLE', 'NETWORK_ERROR'])

export function mapErrorToMessage(err: ApiError): string {
  // VALIDATION_FAILED 特殊处理：若有 fields 数组则拼接提示
  if (err.error_code === 'VALIDATION_FAILED' && err.fields && err.fields.length > 0) {
    return `「${err.fields.join('、')}」字段校验失败`
  }

  // 强制回落的 code（隐藏后端技术细节）
  if (FORCE_FALLBACK_CODES.has(err.error_code)) {
    return WHITELIST_FALLBACK[err.error_code] ?? '操作失败'
  }

  // 后端消息可读时 passthrough（去除明显英文/技术性消息）
  if (err.message && !isLowQualityMessage(err.message)) {
    return err.message
  }

  // 白名单兜底
  return WHITELIST_FALLBACK[err.error_code] ?? err.message ?? '操作失败'
}

function isLowQualityMessage(msg: string): boolean {
  const techPatterns = [
    /^(Unprocessable|Internal|Bad|Not Found|Unauthorized|Forbidden|Conflict)/i,
    /^Exception:/i,
    /Traceback/i,
    /^\{.*\}$/,  // JSON 序列化痕迹
  ]
  return techPatterns.some((p) => p.test(msg.trim()))
}
```

- [ ] **步骤 4 · 手工校验输入输出矩阵**

在 `npm run dev` 启动后，打开浏览器 DevTools Console，粘贴以下片段验证：

```ts
// 可粘贴到浏览器 console（需先 import，或临时 paste 文件内容）
const cases: Array<{ input: ApiError; expected: string }> = [
  { input: { error_code: 'AUTH_UNAUTHORIZED', message: '邮箱或密码错误', http_status: 401 }, expected: '邮箱或密码错误' },
  { input: { error_code: 'AUTH_UNAUTHORIZED', message: 'Unauthorized', http_status: 401 }, expected: '请先登录' },
  { input: { error_code: 'HTTP_400', message: '该邮箱已被注册', http_status: 400 }, expected: '该邮箱已被注册' },
  { input: { error_code: 'VALIDATION_FAILED', message: '请求参数校验失败', fields: ['email', 'password'], http_status: 422 }, expected: '「email、password」字段校验失败' },
  { input: { error_code: 'INTERNAL_SERVER_ERROR', message: 'KeyError: xxx', http_status: 500 }, expected: '服务暂时不可用，请稍后再试' },
  { input: { error_code: 'UNKNOWN_CODE', message: '自定义业务错误', http_status: 400 }, expected: '自定义业务错误' },
]
cases.forEach(({ input, expected }, i) => {
  const actual = mapErrorToMessage(input)
  console.log(`case ${i + 1}: ${actual === expected ? 'PASS' : 'FAIL'} | got="${actual}" | expected="${expected}"`)
})
```

**预期**：6 个 case 全 PASS。

- [ ] **步骤 5 · 运行 type-check**

```bash
cd frontend
npm run type-check
```

**预期**：通过，无新增错误。

**DoD**：`services/errors.ts` 文件存在，导出 `ApiError` / `isApiError` / `inferFromStatus` / `mapErrorToMessage` 4 个符号；6 个测试 case 全通过；type-check 通过。

---

### 任务 2 · 创建 `hooks/useApiError.ts`

**文件：**
- 创建：`frontend/src/hooks/useApiError.ts`

- [ ] **步骤 1 · 写 hook 实现**

```ts
// frontend/src/hooks/useApiError.ts
import { useCallback } from 'react'
import toast from 'react-hot-toast'
import { isApiError, mapErrorToMessage, type ApiError } from '@/services/errors'

interface UseApiErrorReturn {
  /**
   * 弹 toast 提示错误。
   * @param err 错误对象（通常是 catch 到的 ApiError 或 unknown）
   * @param fallback 非 ApiError 时的默认消息
   */
  show: (err: unknown, fallback?: string) => void

  /**
   * 判断指定字段是否在 error.fields 数组中（用于表单错误高亮）。
   */
  hasFieldError: (err: unknown, field: string) => boolean

  /**
   * 获取 ApiError（若 err 是 ApiError 则返回，否则 null）。
   */
  asApiError: (err: unknown) => ApiError | null
}

export function useApiError(): UseApiErrorReturn {
  const show = useCallback((err: unknown, fallback = '操作失败') => {
    if (isApiError(err)) {
      toast.error(mapErrorToMessage(err))
      if (err.request_id && import.meta.env.DEV) {
        console.warn('[api-error]', err.error_code, err.request_id, err.message)
      }
      return
    }
    if (err instanceof Error && err.message) {
      toast.error(err.message)
      return
    }
    toast.error(fallback)
  }, [])

  const hasFieldError = useCallback((err: unknown, field: string) => {
    if (!isApiError(err)) return false
    return Array.isArray(err.fields) && err.fields.includes(field)
  }, [])

  const asApiError = useCallback((err: unknown) => (isApiError(err) ? err : null), [])

  return { show, hasFieldError, asApiError }
}
```

- [ ] **步骤 2 · 运行 type-check**

```bash
cd frontend
npm run type-check
```

**预期**：通过。

- [ ] **步骤 3 · Commit（与 Task 1 合并为一个 commit）**

暂不 commit，等 Task 3-5 完成后一起 commit（因为 M1 是一个完整的契约适配单元，拆太细意义不大）。

**DoD**：hook 创建完毕，暴露 3 个方法，type-check 通过。

---

### 任务 3 · 重写 `services/api.ts` 的响应拦截器

**文件：**
- 修改：`frontend/src/services/api.ts:24-41`（拦截器块）

- [ ] **步骤 1 · 替换响应拦截器**

将 `frontend/src/services/api.ts` 第 24-41 行的响应拦截器块替换为：

```ts
import type { AxiosError } from 'axios'
import { inferFromStatus, type ApiError } from './errors'

// 响应拦截器：1) 解包 data；2) 标准化错误；3) 401 清本地登录态
api.interceptors.response.use(
  (response) => response.data,
  (error: AxiosError) => {
    const status = error.response?.status ?? 0
    const body = (error.response?.data ?? {}) as Record<string, unknown>

    // 构造标准化的 ApiError
    const apiError: ApiError = {
      error_code: (typeof body.error_code === 'string' && body.error_code)
        ? body.error_code
        : inferFromStatus(status),
      message: (typeof body.message === 'string' && body.message)
        || (typeof body.detail === 'string' && body.detail)
        || error.message
        || '网络异常',
      fields: Array.isArray(body.fields) ? (body.fields as string[]) : undefined,
      request_id: (typeof body.request_id === 'string' && body.request_id)
        || (error.response?.headers['x-request-id'] as string | undefined),
      http_status: status,
    }

    // 401 兜底：清本地登录状态，白名单路径外跳转首页
    if (status === 401) {
      const store = useAuthStore.getState()
      store.clearAuth()
      const path = window.location.pathname
      const isWhitelisted = path === '/' || path.includes('/login') || path.includes('/register')
      if (!isWhitelisted) {
        window.location.href = '/'
      }
    }

    return Promise.reject(apiError)
  }
)
```

**关键变更**：
- 原来的 `error.detail = error.response.data.detail` 副作用改为返回 `ApiError`
- `reject(error)` 改为 `reject(apiError)` —— 所有 catch 处拿到的是 `ApiError`
- 401 兜底保持不变

- [ ] **步骤 2 · 运行 type-check**

```bash
cd frontend
npm run type-check
```

**预期**：通过。若有其他文件引用 `error.detail`（旧 API），`type-check` 不会报错（因为 `unknown.detail` 不会触发 TS 检查），但**运行时可能出问题** —— 下一步扫描。

- [ ] **步骤 3 · 扫描旧 `error.detail` 使用点**

```bash
cd frontend
rg "error\.detail|err\.detail|\.detail\s*\|\|" src --type ts --type tsx -l
```

**预期输出**：会列出所有仍在用 `error.detail` 的文件。对每个文件判断：
- 若是 B 范围内要重写的页面（LoginPage/RegisterPage/LoginModal/DashboardPage/LandingPage） → 不处理，等各自 task 重写
- 若是 B 范围外的页面 → 保留旧代码，但拦截器已把 `detail` 信息合并到 `apiError.message` 里，所以现有逻辑仍有意义。**但** 访问 `error.detail` 会是 `undefined`（因为 reject 的是 ApiError，没有 detail 字段）

**决策**：为**最大程度不破坏 B 范围外页面**，在 `ApiError` 里保留一个向后兼容字段。回到步骤 1 的代码，在 `apiError` 构造末尾加：

```ts
      // 向后兼容：某些旧代码访问 err.detail，提供别名
      // @ts-expect-error 兼容字段，未来 C/D 迁移完后移除
      detail: (typeof body.detail === 'string' && body.detail) || apiError_message_for_detail,
```

等等，TS 上做 alias 有点糙。**更稳妥的做法**：在 `ApiError` 接口加可选 `detail?: string` 标注为 "deprecated"：

在 `errors.ts` 的 `ApiError` 接口追加：

```ts
export interface ApiError {
  error_code: string
  message: string
  fields?: string[]
  request_id?: string
  http_status: number
  /** @deprecated 仅为兼容旧代码；新代码请用 message。将在子项目 D 移除。 */
  detail?: string
}
```

在拦截器构造时同步赋值：

```ts
      detail: (typeof body.detail === 'string' && body.detail) || apiError.message,
```

**等等**：上面代码在构造时 `apiError.message` 还未结束赋值，JS 执行顺序上可行但读起来迷。改成：

```ts
    const message = (typeof body.message === 'string' && body.message)
      || (typeof body.detail === 'string' && body.detail)
      || error.message
      || '网络异常'

    const apiError: ApiError = {
      error_code: (typeof body.error_code === 'string' && body.error_code) ? body.error_code : inferFromStatus(status),
      message,
      fields: Array.isArray(body.fields) ? (body.fields as string[]) : undefined,
      request_id: (typeof body.request_id === 'string' && body.request_id) || (error.response?.headers['x-request-id'] as string | undefined),
      http_status: status,
      detail: (typeof body.detail === 'string' && body.detail) || message,
    }
```

**本步骤最终产出**：更新 `errors.ts` 加上 `detail?: string` 字段；更新 `api.ts` 拦截器使用 `message` 中间变量 + 设置 `detail`。

- [ ] **步骤 4 · 重新跑 type-check**

```bash
cd frontend
npm run type-check
```

**预期**：通过。

**DoD**：拦截器返回 `ApiError` 形状；`detail` 字段向后兼容；type-check 通过；B 范围外页面不会因为此变更崩溃。

---

### 任务 4 · 切换 `createMember` / `updateMember` 到新字段

**文件：**
- 修改：`frontend/src/services/api.ts:85-96`

- [ ] **步骤 1 · 更新签名**

原代码：

```85:96:frontend/src/services/api.ts
  createMember: (archiveId: number, data: {
    name: string; relationship_type: string; birth_year?: number; death_year?: number; bio?: string
  }) => api.post(`/archives/${archiveId}/members`, data),
```

替换为：

```ts
  createMember: (archiveId: number, data: {
    name: string
    relationship_type: string
    birth_year?: number
    /** 关系状态：alive=健在 / deceased=已离开 / unknown=未明示。E 已是唯一真源，B 不再传 death_year。 */
    status?: 'alive' | 'deceased' | 'unknown'
    /** 结束年份（status=deceased 时为辞世年；status=alive 时可空；对组织/关系可表示终止年） */
    end_year?: number
    bio?: string
  }) => api.post(`/archives/${archiveId}/members`, data),

  updateMember: (archiveId: number, memberId: number, data: {
    name?: string
    relationship_type?: string
    birth_year?: number
    status?: 'alive' | 'deceased' | 'unknown'
    end_year?: number
    bio?: string
  }) => api.patch(`/archives/${archiveId}/members/${memberId}`, data),
```

**注意**：原 `updateMember` 签名是 `data: object`（完全松散），换为严格签名时需确认调用方是否有"偷偷用旧字段"的情况。

- [ ] **步骤 2 · 扫描 `death_year` 使用点**

```bash
cd frontend
rg "death_year|is_alive" src --type ts --type tsx -n
```

**预期**：可能在 ArchiveDetailPage / MemberDetail 或其子组件内出现。对每个出现点：
- 若是 B 范围内页面（无，B 不碰这些页面）→ 跳过
- 若是 B 范围外（如 ArchiveDetailPage）→ **暂时保留**；C 子项目重构这些页面时会清理。但要保证**当前代码不因签名变严而崩溃** —— 看 TS 报错。

若扫描后 `npm run type-check` 发现旧代码传 `death_year` 报错，有两种选择：
- (A) **当前 task 内快速修复为新字段**（若改动小，≤ 3 行）
- (B) **撤销严格签名**，用 `data: object` 宽松签名过渡，留给 C 收紧

**选择**：先尝试 A；若报错点 > 5 处，改 B。

- [ ] **步骤 3 · 运行 type-check 并迭代**

```bash
cd frontend
npm run type-check
```

若报错，按步骤 2 的策略迭代。最终无错后进入下一步。

- [ ] **步骤 4 · 手工冒烟（延后到 Task 6 统一做）**

**DoD**：`createMember`/`updateMember` 签名用 `status` + `end_year`；type-check 通过；无旧 `death_year` 调用点遗留（或已用宽松签名过渡）。

---

### 任务 5 · 清理 `api.ts` 中的无效 import 与补齐 AuthApi 响应类型

- [ ] **步骤 1 · 确认无孤儿 import**

```bash
cd frontend
rg "from '@/services/errors'" src --type ts --type tsx -n
```

**预期**：至少 1 处（在 api.ts 里）。

- [ ] **步骤 2 · 提升 authApi 的类型表达（供 useAuthForm 消费）**

在 `api.ts` 顶部加导出类型：

```ts
export interface AuthUser {
  id: number
  email: string
  username: string
  avatar_url?: string | null
  created_at: string
  last_active_at?: string | null
}

export interface AuthResponse {
  access_token: string
  token_type: 'bearer'
  user: AuthUser
}
```

并将 `authApi.login` / `authApi.register` 显式标注返回类型：

```ts
export const authApi = {
  register: (data: { email: string; username: string; password: string }): Promise<AuthResponse> =>
    api.post('/auth/register', data),

  login: (email: string, password: string): Promise<AuthResponse> =>
    api.post('/auth/login', new URLSearchParams({ username: email, password }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }),
  // ... 其余保持
}
```

**注意**：axios 泛型可以用 `api.post<AuthResponse>(...)`，但当前 baseURL 响应拦截器返回的是 `response.data`（拆过包），TS 类型会是 `any`。显式 `Promise<AuthResponse>` 更保险。

- [ ] **步骤 3 · 运行 type-check**

```bash
cd frontend
npm run type-check
```

**预期**：通过。

**DoD**：`AuthUser` / `AuthResponse` 导出可供 `useAuthForm` 消费；type-check 通过。

---

### 任务 6 · M1 手工冒烟 + Commit

- [ ] **步骤 1 · 启动 backend（若未运行）**

```bash
cd infra
docker compose up -d postgres redis minio
cd ../backend
# （若本地 py 环境） uvicorn app.main:app --reload
# 或在另一个 docker compose 服务里
```

（假设后端已在运行。若没有，先按 E 交付文档启动）

- [ ] **步骤 2 · 启动 frontend dev**

```bash
cd frontend
npm run dev
```

- [ ] **步骤 3 · 冒烟清单**

手工点击验证（在浏览器里）：

| 场景 | 操作 | 预期 |
|---|---|---|
| 登录失败（邮箱错） | `/login`，输 `wrong@x.com` + 任意密码，提交 | Toast 显示"邮箱或密码错误"（passthrough 后端 detail）|
| 登录失败（密码错） | `/login`，输真实邮箱 + 错密码 | Toast 显示"邮箱或密码错误" |
| 注册冲突 | `/register`，用已注册邮箱 | Toast 显示"该邮箱已被注册" |
| 注册字段校验失败 | `/register`，邮箱填 `abc`（非法格式）| Toast 显示含"email"的校验消息（VALIDATION_FAILED）|
| 401 跳转 | 手工删除 `localStorage['mtc-token']`，刷新任一需登录页面 | 跳回 `/` |
| DevTools 输出 request_id（dev 模式）| 触发任一错误 | Console 有 `[api-error] ...` 日志含 request_id |

**记录**：若有任一不符合预期，回到对应 task 修复。

- [ ] **步骤 4 · Commit**

```bash
cd d:/Fish-code/MTC
git add frontend/src/services/errors.ts frontend/src/hooks/useApiError.ts frontend/src/services/api.ts
git status  # 确认只有这 3 个文件，无意外改动
```

写 commit 消息文件 `.git/COMMIT_M1`（内容）：

```
feat(B): M1 · API 契约适配 + 统一错误处理架构

- 新增 services/errors.ts：ApiError/isApiError/inferFromStatus/mapErrorToMessage
- 新增 hooks/useApiError.ts：show() / hasFieldError() / asApiError()
- 重写 services/api.ts 响应拦截器：reject ApiError 形状，兼容旧 detail 字段
- createMember / updateMember 签名切换到 status + end_year（对齐 E）
- passthrough 策略：后端中文 message 优先；白名单仅对技术性消息兜底
- 不在白名单里的 AUTH_INVALID_CREDENTIALS/AUTH_EMAIL_TAKEN 等细粒度 code
  待 C/D 迁 auth.py 到 DomainError 后再补
```

```bash
git commit -F .git/COMMIT_M1
Remove-Item .git/COMMIT_M1
git log --oneline -2
```

- [ ] **步骤 5 · Push**

```bash
git push origin Opus-coding
```

**DoD**：M1 所有变更 commit 到 `Opus-coding`；远程 push 成功；手工冒烟全通过。

---

# Milestone 2 · 认证三件套统一

---

### 任务 7 · 创建 `hooks/useAuthForm.ts`

**文件：**
- 创建：`frontend/src/hooks/useAuthForm.ts`

- [ ] **步骤 1 · 写完整实现**

```ts
// frontend/src/hooks/useAuthForm.ts
import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { authApi } from '@/services/api'
import { useAuthStore } from '@/hooks/useAuthStore'
import { useApiError } from './useApiError'
import { isApiError } from '@/services/errors'

type AuthMode = 'login' | 'register'

export interface UseAuthFormOptions {
  mode: AuthMode
  /**
   * 成功后的回调。若未提供，默认 window.location.href = returnTo。
   * LoginModal 场景可传入 close modal 等副作用。
   */
  onSuccess?: () => void
  /**
   * 覆盖 returnTo。未提供时从 useSearchParams 读取 'returnTo'，回落 '/dashboard'。
   */
  returnToOverride?: string
}

export interface UseAuthFormReturn {
  email: string
  setEmail: (v: string) => void
  password: string
  setPassword: (v: string) => void
  username: string
  setUsername: (v: string) => void
  confirmPassword: string
  setConfirmPassword: (v: string) => void
  showPassword: boolean
  togglePassword: () => void
  showConfirm: boolean
  toggleConfirm: () => void
  rememberMe: boolean
  setRememberMe: (v: boolean) => void
  loading: boolean
  /** 最后一次提交失败的错误（非 ApiError 也可能是 Error） */
  submitError: unknown | null
  handleSubmit: (e: FormEvent) => Promise<void>
}

export function useAuthForm({ mode, onSuccess, returnToOverride }: UseAuthFormOptions): UseAuthFormReturn {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState<unknown | null>(null)

  const [searchParams] = useSearchParams()
  const { setAuth } = useAuthStore()
  const apiError = useApiError()

  const returnTo = returnToOverride ?? searchParams.get('returnTo') ?? '/dashboard'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (loading) return

    setSubmitError(null)

    // 客户端前置校验
    if (!email.trim()) {
      toast.error('请输入邮箱')
      return
    }
    if (!password) {
      toast.error('请输入密码')
      return
    }
    if (mode === 'register') {
      if (!username.trim()) {
        toast.error('请输入用户名')
        return
      }
      if (password !== confirmPassword) {
        toast.error('两次输入的密码不一致')
        return
      }
      if (password.length < 6) {
        toast.error('密码至少 6 位')
        return
      }
    }

    setLoading(true)
    try {
      const response = mode === 'login'
        ? await authApi.login(email.trim(), password)
        : await authApi.register({ username: username.trim(), email: email.trim(), password })

      if (!response?.access_token || !response?.user) {
        throw new Error('登录响应格式异常，请联系管理员')
      }

      if (mode === 'login' && rememberMe) {
        localStorage.setItem('mtc-remember', 'true')
      }

      setAuth(response.access_token, response.user)
      toast.success(mode === 'login' ? '登录成功' : '注册成功，已自动登录')

      if (onSuccess) {
        onSuccess()
      } else {
        const target = returnTo.startsWith('/') ? returnTo : '/dashboard'
        // 使用硬刷新确保所有 react-query 缓存清空（与旧行为一致）
        window.location.href = target
      }
    } catch (err) {
      if (isApiError(err) || err instanceof Error) {
        setSubmitError(err)
      } else {
        setSubmitError(new Error('未知错误'))
      }
      apiError.show(err, mode === 'login' ? '登录失败' : '注册失败')
    } finally {
      setLoading(false)
    }
  }

  return {
    email, setEmail,
    password, setPassword,
    username, setUsername,
    confirmPassword, setConfirmPassword,
    showPassword, togglePassword: () => setShowPassword((v) => !v),
    showConfirm, toggleConfirm: () => setShowConfirm((v) => !v),
    rememberMe, setRememberMe,
    loading, submitError,
    handleSubmit,
  }
}
```

- [ ] **步骤 2 · type-check**

```bash
cd frontend
npm run type-check
```

**预期**：通过。

**DoD**：hook 创建完毕，导出 `UseAuthFormOptions` / `UseAuthFormReturn` / `useAuthForm`；type-check 通过。

---

### 任务 8 · 重写 `pages/LoginPage.tsx`

**文件：**
- 修改：`frontend/src/pages/LoginPage.tsx`（全文件重写）

- [ ] **步骤 1 · 读原文件（任务本身） + 识别保留点**

读 `frontend/src/pages/LoginPage.tsx`，记录：
- 品牌头：心形 logo + "MTC" 文字
- 浮动 orb 背景装饰
- "还没有账号？ → 立即注册" 尾链

这些保留，逻辑层换 hook。

- [ ] **步骤 2 · 全文件替换**

```tsx
// frontend/src/pages/LoginPage.tsx
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { Heart, Eye, EyeOff, Mail, Lock, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useAuthForm } from '@/hooks/useAuthForm'
import { fadeUp, staggerContainer } from '@/lib/motion'

export default function LoginPage() {
  const form = useAuthForm({ mode: 'login' })

  return (
    <div className="relative min-h-screen overflow-hidden bg-warm-50 flex items-center justify-center px-4 py-12">
      {/* 浮动背景装饰（纯 CSS，不走 motion） */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="floating-orb floating-orb-jade w-[480px] h-[480px] -top-32 -left-32 opacity-40" />
        <div className="floating-orb floating-orb-amber w-[360px] h-[360px] -bottom-24 -right-24 opacity-30" />
      </div>

      <motion.div
        className="relative w-full max-w-md"
        variants={staggerContainer(0.06)}
        initial="hidden"
        animate="visible"
      >
        {/* 品牌头 */}
        <motion.div variants={fadeUp} className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-ink-700 hover:text-jade-600 transition-colors">
            <Heart className="w-6 h-6 text-jade-600" fill="currentColor" />
            <span className="font-serif text-2xl tracking-wider">MTC</span>
          </Link>
          <h1 className="font-serif text-3xl text-ink-900 mt-4">欢迎回来</h1>
          <p className="text-ink-600 mt-2">回到你守护的记忆里</p>
        </motion.div>

        {/* 表单卡片 */}
        <motion.div variants={fadeUp}>
          <Card variant="glass" padding="lg">
            <form onSubmit={form.handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-ink-700 mb-1.5">
                  邮箱
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  icon={<Mail className="w-4 h-4" />}
                  value={form.email}
                  onChange={(e) => form.setEmail(e.target.value)}
                  placeholder="you@example.com"
                  disabled={form.loading}
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-ink-700 mb-1.5">
                  密码
                </label>
                <Input
                  id="password"
                  type={form.showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  icon={<Lock className="w-4 h-4" />}
                  trailing={
                    <button
                      type="button"
                      onClick={form.togglePassword}
                      className="text-ink-500 hover:text-ink-700 transition-colors"
                      aria-label={form.showPassword ? '隐藏密码' : '显示密码'}
                    >
                      {form.showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                  value={form.password}
                  onChange={(e) => form.setPassword(e.target.value)}
                  placeholder="请输入密码"
                  disabled={form.loading}
                  required
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-ink-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.rememberMe}
                  onChange={(e) => form.setRememberMe(e.target.checked)}
                  className="rounded border-ink-300 text-jade-600 focus:ring-jade-500"
                />
                <span>记住我（7 天免登录）</span>
              </label>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={form.loading}
                icon={form.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
              >
                {form.loading ? '登录中...' : '登录'}
              </Button>
            </form>
          </Card>
        </motion.div>

        <motion.p variants={fadeUp} className="text-center text-sm text-ink-600 mt-6">
          还没有账号？{' '}
          <Link to="/register" className="text-jade-600 hover:text-jade-700 font-medium">
            立即注册
          </Link>
        </motion.p>
      </motion.div>
    </div>
  )
}
```

**关键**：
- `useAuthForm({ mode: 'login' })` 接管所有状态
- `motion` 替换原 framer-motion（A 基座用 `motion/react`）
- A 基座的 `Button` / `Card` / `Input` 替换手写
- 浮动 orb CSS 类保留（pure-css 装饰级动画）

- [ ] **步骤 3 · 验证 Input 组件是否支持 `icon` / `trailing` props**

```bash
cd frontend
rg "interface InputProps|InputHTMLAttributes" src/components/ui/Input.tsx -A 20
```

**若不支持** `icon` / `trailing`（A 基座可能只有基础 Input），则需在本 task 内用简单 flex 布局包装：

```tsx
<div className="relative">
  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-500" />
  <Input className="pl-10" ... />
</div>
```

验证后调整 LoginPage 代码。

- [ ] **步骤 4 · type-check + 视觉冒烟**

```bash
cd frontend
npm run type-check
npm run dev
```

浏览器访问 `http://localhost:5173/login`：
- [ ] 品牌头居中 + 浮动背景有呼吸感
- [ ] 输入邮箱/密码，点击登录，走到 E 后端（返回应正常）
- [ ] 密码显示/隐藏切换工作
- [ ] 记住我复选框工作
- [ ] 错误信息通过 toast 展示

**DoD**：LoginPage 重写完成，使用 `useAuthForm`；手工冒烟通过；type-check 通过。

---

### 任务 9 · 重写 `pages/RegisterPage.tsx`

**文件：**
- 修改：`frontend/src/pages/RegisterPage.tsx`

- [ ] **步骤 1 · 全文件替换**

```tsx
// frontend/src/pages/RegisterPage.tsx
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { Heart, Eye, EyeOff, Mail, Lock, User, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { useAuthForm } from '@/hooks/useAuthForm'
import { fadeUp, staggerContainer } from '@/lib/motion'

export default function RegisterPage() {
  const form = useAuthForm({ mode: 'register' })

  return (
    <div className="relative min-h-screen overflow-hidden bg-warm-50 flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="floating-orb floating-orb-jade w-[480px] h-[480px] -top-32 -right-32 opacity-40" />
        <div className="floating-orb floating-orb-amber w-[360px] h-[360px] -bottom-24 -left-24 opacity-30" />
      </div>

      <motion.div
        className="relative w-full max-w-md"
        variants={staggerContainer(0.06)}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={fadeUp} className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-ink-700 hover:text-jade-600 transition-colors">
            <Heart className="w-6 h-6 text-jade-600" fill="currentColor" />
            <span className="font-serif text-2xl tracking-wider">MTC</span>
          </Link>
          <h1 className="font-serif text-3xl text-ink-900 mt-4">创建账号</h1>
          <p className="text-ink-600 mt-2">开始守护你的珍贵记忆</p>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Card variant="glass" padding="lg">
            <form onSubmit={form.handleSubmit} className="space-y-5">
              <FormField id="username" label="用户名" icon={<User className="w-4 h-4" />}
                value={form.username} onChange={form.setUsername}
                placeholder="如何称呼你" disabled={form.loading} required autoComplete="username"
              />

              <FormField id="email" label="邮箱" type="email" icon={<Mail className="w-4 h-4" />}
                value={form.email} onChange={form.setEmail}
                placeholder="you@example.com" disabled={form.loading} required autoComplete="email"
              />

              <PasswordField id="password" label="密码"
                value={form.password} onChange={form.setPassword}
                show={form.showPassword} toggle={form.togglePassword}
                placeholder="至少 6 位" disabled={form.loading} autoComplete="new-password"
              />

              <PasswordField id="confirmPassword" label="确认密码"
                value={form.confirmPassword} onChange={form.setConfirmPassword}
                show={form.showConfirm} toggle={form.toggleConfirm}
                placeholder="再次输入密码" disabled={form.loading} autoComplete="new-password"
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={form.loading}
                icon={form.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
              >
                {form.loading ? '注册中...' : '创建账号'}
              </Button>
            </form>
          </Card>
        </motion.div>

        <motion.p variants={fadeUp} className="text-center text-sm text-ink-600 mt-6">
          已有账号？{' '}
          <Link to="/login" className="text-jade-600 hover:text-jade-700 font-medium">
            立即登录
          </Link>
        </motion.p>
      </motion.div>
    </div>
  )
}

// 本地组件：消除 Input 嵌套重复
function FormField(props: {
  id: string; label: string; value: string; onChange: (v: string) => void
  placeholder?: string; disabled?: boolean; required?: boolean
  type?: string; autoComplete?: string; icon?: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={props.id} className="block text-sm font-medium text-ink-700 mb-1.5">
        {props.label}
      </label>
      <Input
        id={props.id}
        type={props.type ?? 'text'}
        autoComplete={props.autoComplete}
        icon={props.icon}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        disabled={props.disabled}
        required={props.required}
      />
    </div>
  )
}

function PasswordField(props: {
  id: string; label: string; value: string; onChange: (v: string) => void
  show: boolean; toggle: () => void
  placeholder?: string; disabled?: boolean; autoComplete?: string
}) {
  return (
    <div>
      <label htmlFor={props.id} className="block text-sm font-medium text-ink-700 mb-1.5">
        {props.label}
      </label>
      <Input
        id={props.id}
        type={props.show ? 'text' : 'password'}
        autoComplete={props.autoComplete}
        icon={<Lock className="w-4 h-4" />}
        trailing={
          <button type="button" onClick={props.toggle}
            className="text-ink-500 hover:text-ink-700 transition-colors"
            aria-label={props.show ? '隐藏密码' : '显示密码'}>
            {props.show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        }
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        disabled={props.disabled}
        required
      />
    </div>
  )
}
```

注：若 Task 8 步骤 3 验证 Input 不支持 `icon` / `trailing`，这里的 `FormField` / `PasswordField` 内部改用 relative 布局 + 绝对定位 icon。

- [ ] **步骤 2 · type-check + 视觉冒烟**

```bash
cd frontend
npm run type-check
npm run dev  # 若未运行
```

访问 `/register`：
- [ ] 四个字段均正常输入
- [ ] 密码不一致时 toast 提示
- [ ] 密码 < 6 位 toast 提示
- [ ] 成功注册自动登录并跳转 /dashboard

**DoD**：RegisterPage 重写完成；手工冒烟通过。

---

### 任务 10 · 重写 `components/LoginModal.tsx` + M2 commit

**文件：**
- 修改：`frontend/src/components/LoginModal.tsx`

- [ ] **步骤 1 · 全文件替换**

```tsx
// frontend/src/components/LoginModal.tsx
import { Heart, Eye, EyeOff, Mail, Lock, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuthForm } from '@/hooks/useAuthForm'

interface LoginModalProps {
  open: boolean
  onClose: () => void
  /**
   * 登录成功后的回调。默认 onClose + navigate('/dashboard')。
   */
  onSuccess?: () => void
}

export function LoginModal({ open, onClose, onSuccess }: LoginModalProps) {
  const navigate = useNavigate()

  const form = useAuthForm({
    mode: 'login',
    onSuccess: () => {
      onClose()
      if (onSuccess) {
        onSuccess()
      } else {
        navigate('/dashboard')
      }
    },
  })

  return (
    <Modal open={open} onClose={onClose} size="md">
      <div className="p-6">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 text-ink-700">
            <Heart className="w-6 h-6 text-jade-600" fill="currentColor" />
            <span className="font-serif text-xl tracking-wider">MTC</span>
          </div>
          <h2 className="font-serif text-2xl text-ink-900 mt-3">登录</h2>
          <p className="text-ink-600 text-sm mt-1">继续守护你的记忆</p>
        </div>

        <form onSubmit={form.handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="modal-email" className="block text-sm font-medium text-ink-700 mb-1.5">
              邮箱
            </label>
            <Input id="modal-email" type="email" autoComplete="email"
              icon={<Mail className="w-4 h-4" />}
              value={form.email}
              onChange={(e) => form.setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={form.loading}
              required
            />
          </div>

          <div>
            <label htmlFor="modal-password" className="block text-sm font-medium text-ink-700 mb-1.5">
              密码
            </label>
            <Input id="modal-password"
              type={form.showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              icon={<Lock className="w-4 h-4" />}
              trailing={
                <button type="button" onClick={form.togglePassword}
                  className="text-ink-500 hover:text-ink-700 transition-colors"
                  aria-label={form.showPassword ? '隐藏密码' : '显示密码'}>
                  {form.showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
              value={form.password}
              onChange={(e) => form.setPassword(e.target.value)}
              placeholder="请输入密码"
              disabled={form.loading}
              required
            />
          </div>

          <Button type="submit" variant="primary" size="lg" className="w-full"
            disabled={form.loading}
            icon={form.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}>
            {form.loading ? '登录中...' : '登录'}
          </Button>
        </form>

        <div className="text-center text-sm text-ink-600 mt-4">
          还没有账号？{' '}
          <button
            type="button"
            onClick={() => { onClose(); navigate('/register') }}
            className="text-jade-600 hover:text-jade-700 font-medium"
          >
            创建账号
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default LoginModal
```

**注意**：原 `LoginModal.tsx` 的 `export` 形式可能是默认导出 + 命名导出混用，需保持与调用方一致。扫描使用点：

```bash
cd frontend
rg "LoginModal" src --type ts --type tsx -n
```

按使用方式选择正确的 export 形式。

- [ ] **步骤 2 · type-check + 视觉冒烟**

```bash
cd frontend
npm run type-check
npm run dev
```

访问 `/`（Landing）：
- [ ] 导航栏或 CTA 触发 LoginModal 的入口
- [ ] Modal 打开、背景 backdrop、ESC 关闭、点击遮罩关闭
- [ ] 输入邮箱密码登录成功后 Modal 关闭 + 跳 /dashboard

- [ ] **步骤 3 · Commit M2**

```bash
cd d:/Fish-code/MTC
git add frontend/src/hooks/useAuthForm.ts frontend/src/pages/LoginPage.tsx frontend/src/pages/RegisterPage.tsx frontend/src/components/LoginModal.tsx
git status
```

写 `.git/COMMIT_M2`：

```
feat(B): M2 · 认证三件套统一 + useAuthForm hook

- 新增 hooks/useAuthForm.ts：Login/Register 共享状态 + submit 逻辑
- 重写 LoginPage：用 A 基座 Card/Input/Button + motion staggerContainer
- 重写 RegisterPage：同上，extract FormField/PasswordField 本地组件
- 重写 LoginModal：用 A 基座 Modal + useAuthForm onSuccess 回调
- 文案按 spec § 4.3 改写："回到你守护的记忆里" / "开始守护你的珍贵记忆"
- 保留三入口：/login 页面、/register 页面、Landing 的 LoginModal
```

```bash
git commit -F .git/COMMIT_M2
Remove-Item .git/COMMIT_M2
git push origin Opus-coding
```

**DoD**：M2 所有变更 commit + push；三个入口手工冒烟通过。

---

# Milestone 4 · Dashboard 数据聚合

---

### 任务 11 · 创建空/错/载态三件套

**文件：**
- 创建：`frontend/src/components/ui/state/EmptyState.tsx`
- 创建：`frontend/src/components/ui/state/ErrorState.tsx`
- 创建：`frontend/src/components/ui/state/LoadingState.tsx`
- 创建：`frontend/src/components/ui/state/index.ts`

- [ ] **步骤 1 · 创建 EmptyState**

```tsx
// frontend/src/components/ui/state/EmptyState.tsx
import { Inbox, type LucideIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { Button, type ButtonProps } from '@/components/ui/Button'
import { fadeUp } from '@/lib/motion'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    variant?: ButtonProps['variant']
  }
  className?: string
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, className }: EmptyStateProps) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className={cn(
        'flex flex-col items-center justify-center text-center py-12 px-6',
        className
      )}
    >
      <div className="w-16 h-16 rounded-full bg-warm-100 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-ink-500" />
      </div>
      <h3 className="font-serif text-xl text-ink-900 mb-2">{title}</h3>
      {description && <p className="text-ink-600 max-w-md mb-6">{description}</p>}
      {action && (
        <Button variant={action.variant ?? 'primary'} onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </motion.div>
  )
}
```

- [ ] **步骤 2 · 创建 ErrorState**

```tsx
// frontend/src/components/ui/state/ErrorState.tsx
import { AlertCircle, RefreshCw } from 'lucide-react'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/Button'
import { fadeUp } from '@/lib/motion'
import { isApiError, mapErrorToMessage, type ApiError } from '@/services/errors'
import { cn } from '@/lib/utils'

interface ErrorStateProps {
  title?: string
  error?: ApiError | Error | string | null
  onRetry?: () => void
  /** sm = 小卡片内嵌；md = 页面级 */
  size?: 'sm' | 'md'
  className?: string
}

export function ErrorState({ title = '出了点问题', error, onRetry, size = 'md', className }: ErrorStateProps) {
  const message = resolveMessage(error)
  const isSmall = size === 'sm'

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className={cn(
        'flex flex-col items-center justify-center text-center',
        isSmall ? 'py-6 px-4' : 'py-12 px-6',
        className
      )}
    >
      <div className={cn(
        'rounded-full bg-rose-50 flex items-center justify-center mb-3',
        isSmall ? 'w-10 h-10' : 'w-14 h-14'
      )}>
        <AlertCircle className={cn('text-rose-500', isSmall ? 'w-5 h-5' : 'w-7 h-7')} />
      </div>
      <h3 className={cn(
        'font-serif text-ink-900 mb-1',
        isSmall ? 'text-base' : 'text-xl'
      )}>{title}</h3>
      {message && <p className={cn('text-ink-600 max-w-md', isSmall ? 'text-xs mb-3' : 'text-sm mb-4')}>{message}</p>}
      {onRetry && (
        <Button
          variant="secondary"
          size={isSmall ? 'sm' : 'md'}
          onClick={onRetry}
          icon={<RefreshCw className={isSmall ? 'w-3 h-3' : 'w-4 h-4'} />}
        >
          重试
        </Button>
      )}
    </motion.div>
  )
}

function resolveMessage(err: ApiError | Error | string | null | undefined): string | null {
  if (!err) return null
  if (typeof err === 'string') return err
  if (isApiError(err)) return mapErrorToMessage(err)
  if (err instanceof Error) return err.message
  return null
}
```

- [ ] **步骤 3 · 创建 LoadingState**

```tsx
// frontend/src/components/ui/state/LoadingState.tsx
import { Loader2 } from 'lucide-react'
import { motion } from 'motion/react'
import { fadeIn } from '@/lib/motion'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'

interface LoadingStateProps {
  variant?: 'spinner' | 'skeleton-cards' | 'skeleton-list'
  message?: string
  /** skeleton-cards/list 时指定占位数量，默认 3 */
  count?: number
  className?: string
}

export function LoadingState({ variant = 'spinner', message, count = 3, className }: LoadingStateProps) {
  if (variant === 'skeleton-cards') {
    return (
      <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-3', className)}>
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-lg" />
        ))}
      </div>
    )
  }

  if (variant === 'skeleton-list') {
    return (
      <div className={cn('space-y-3', className)}>
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    )
  }

  // spinner
  return (
    <motion.div
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      className={cn('flex flex-col items-center justify-center py-12 px-6', className)}
    >
      <Loader2 className="w-8 h-8 text-jade-600 animate-spin mb-3" />
      {message && <p className="text-sm text-ink-600">{message}</p>}
    </motion.div>
  )
}
```

- [ ] **步骤 4 · 创建 barrel index**

```ts
// frontend/src/components/ui/state/index.ts
export { EmptyState } from './EmptyState'
export { ErrorState } from './ErrorState'
export { LoadingState } from './LoadingState'
```

- [ ] **步骤 5 · 验证依赖**

```bash
cd frontend
rg "export.*Skeleton" src/components/ui/Skeleton.tsx
rg "cn\s*\(" src/lib/utils.ts
```

若 `Skeleton` 或 `cn` 不存在，调整 import 为实际可用的路径。

- [ ] **步骤 6 · type-check**

```bash
cd frontend
npm run type-check
```

**预期**：通过。

**DoD**：三件套组件文件存在；barrel 导出完整；type-check 通过。

---

### 任务 12 · 创建 `hooks/useDashboardStats.ts`

**文件：**
- 创建：`frontend/src/hooks/useDashboardStats.ts`

- [ ] **步骤 1 · 创建 hook**

```ts
// frontend/src/hooks/useDashboardStats.ts
import { useQuery } from '@tanstack/react-query'
import { archiveApi, memoryApi, usageApi } from '@/services/api'

// 本地类型（避免依赖 backend schema；E 交付的 JSON 形状）
interface ArchiveItem {
  id: number
  name: string
  archive_type: string
  member_count: number
  memory_count: number
}

interface MemoryItem {
  id: number
  title: string
  content_text: string
  created_at: string
  member_id: number
  archive_id?: number
}

interface UsageStats {
  storage_used?: number
  storage_quota?: number
  ai_tokens_this_month?: number
  ai_tokens_quota?: number
}

export interface DashboardStats {
  archives: ArchiveItem[]
  recentMemories: MemoryItem[]
  usage: UsageStats | null
  archiveCount: number
  memoryCount: number
  archivesByType: Record<string, number>
  lastActivityAt: string | null
  isLoading: boolean
  isError: boolean
  errors: {
    archives: unknown
    recentMemories: unknown
    usage: unknown
  }
  refetchAll: () => void
}

export function useDashboardStats(): DashboardStats {
  const archivesQuery = useQuery<ArchiveItem[]>({
    queryKey: ['dashboard', 'archives'],
    queryFn: () => archiveApi.list(),
    staleTime: 30_000,
  })

  const memoriesQuery = useQuery<MemoryItem[]>({
    queryKey: ['dashboard', 'recent-memories'],
    queryFn: () => memoryApi.list({ limit: 10 }),
    staleTime: 30_000,
  })

  const usageQuery = useQuery<UsageStats>({
    queryKey: ['dashboard', 'usage'],
    queryFn: () => usageApi.getStats(),
    staleTime: 60_000,
  })

  const archives = archivesQuery.data ?? []
  const recentMemories = memoriesQuery.data ?? []
  const usage = usageQuery.data ?? null

  const archiveCount = archives.length
  const memoryCount = archives.reduce((sum, a) => sum + (a.memory_count ?? 0), 0)

  const archivesByType: Record<string, number> = {}
  for (const a of archives) {
    archivesByType[a.archive_type] = (archivesByType[a.archive_type] ?? 0) + 1
  }

  const lastActivityAt = recentMemories.length > 0
    ? recentMemories
        .map((m) => m.created_at)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null
    : null

  return {
    archives,
    recentMemories,
    usage,
    archiveCount,
    memoryCount,
    archivesByType,
    lastActivityAt,
    isLoading: archivesQuery.isLoading || memoriesQuery.isLoading || usageQuery.isLoading,
    isError: archivesQuery.isError && memoriesQuery.isError && usageQuery.isError,
    errors: {
      archives: archivesQuery.error,
      recentMemories: memoriesQuery.error,
      usage: usageQuery.error,
    },
    refetchAll: () => {
      archivesQuery.refetch()
      memoriesQuery.refetch()
      usageQuery.refetch()
    },
  }
}
```

- [ ] **步骤 2 · type-check**

```bash
cd frontend
npm run type-check
```

**DoD**：hook 文件创建；导出 `DashboardStats` 接口；type-check 通过。

---

### 任务 13 · 重写 `pages/DashboardPage.tsx`

**文件：**
- 修改：`frontend/src/pages/DashboardPage.tsx`（全量重写）

- [ ] **步骤 1 · 重写**

```tsx
// frontend/src/pages/DashboardPage.tsx
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import {
  Archive, FileHeart, Clock, HardDrive, MessageCircle, BookOpen, Plus, Users,
} from 'lucide-react'
import { useAuthStore } from '@/hooks/useAuthStore'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state'
import { ScrollReveal, ScrollRevealGroup } from '@/components/ui/ScrollReveal'
import { fadeUp, staggerContainer } from '@/lib/motion'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

const ARCHIVE_TYPE_LABELS: Record<string, string> = {
  family: '家人',
  friend: '挚友',
  lover: '爱人',
  mentor: '良师',
  idol: '偶像',
  other: '其他',
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const stats = useDashboardStats()

  const welcomeTitle = user?.username ? `${user.username}，欢迎回来` : '欢迎'
  const isEmpty = !stats.isLoading && stats.archiveCount === 0 && !stats.isError

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <motion.header
        variants={staggerContainer(0.05)}
        initial="hidden"
        animate="visible"
        className="mb-8"
      >
        <motion.h1 variants={fadeUp} className="font-serif text-3xl md:text-4xl text-ink-900">
          {welcomeTitle}
        </motion.h1>
        <motion.p variants={fadeUp} className="text-ink-600 mt-2">
          每一段记忆都值得被守护
        </motion.p>
      </motion.header>

      {/* 空态 */}
      {isEmpty && (
        <EmptyState
          icon={Archive}
          title="开始你的第一段记忆"
          description="创建一个档案，把想守护的关系安顿进来"
          action={{
            label: '创建档案',
            onClick: () => navigate('/archives?new=1'),
          }}
        />
      )}

      {!isEmpty && (
        <>
          {/* KPI 四卡 */}
          <ScrollRevealGroup stagger={0.06} className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <KPICard
              icon={Archive}
              label="关系档案"
              value={stats.archiveCount}
              suffix="个"
              loading={stats.isLoading}
              error={stats.errors.archives}
              onRetry={stats.refetchAll}
            />
            <KPICard
              icon={FileHeart}
              label="守护的记忆"
              value={stats.memoryCount}
              suffix="条"
              loading={stats.isLoading}
              error={stats.errors.archives}
              onRetry={stats.refetchAll}
            />
            <KPICard
              icon={Clock}
              label="最近守护"
              value={stats.lastActivityAt ? dayjs(stats.lastActivityAt).fromNow() : '—'}
              loading={stats.isLoading}
              error={stats.errors.recentMemories}
              onRetry={stats.refetchAll}
            />
            <KPICard
              icon={HardDrive}
              label="存储用量"
              value={formatStorageUsage(stats.usage)}
              loading={stats.isLoading}
              error={stats.errors.usage}
              onRetry={stats.refetchAll}
            />
          </ScrollRevealGroup>

          {/* 快捷操作 */}
          <ScrollReveal>
            <Card variant="plain" padding="lg" className="mb-8">
              <h2 className="font-serif text-xl text-ink-900 mb-4">快捷操作</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <QuickAction
                  icon={Plus}
                  label="创建档案"
                  onClick={() => navigate('/archives?new=1')}
                />
                <QuickAction
                  icon={MessageCircle}
                  label="与记忆对话"
                  onClick={() => navigate('/dialogue')}
                />
                <QuickAction
                  icon={BookOpen}
                  label="生成生命故事"
                  onClick={() => navigate('/storybook')}
                />
                <QuickAction
                  icon={Users}
                  label="所有档案"
                  onClick={() => navigate('/archives')}
                />
              </div>
            </Card>
          </ScrollReveal>

          {/* 档案类型分布 */}
          {stats.archives.length > 0 && (
            <ScrollReveal>
              <Card variant="plain" padding="lg" className="mb-8">
                <h2 className="font-serif text-xl text-ink-900 mb-4">档案分布</h2>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(stats.archivesByType).map(([type, count]) => (
                    <Badge key={type} variant="default">
                      {ARCHIVE_TYPE_LABELS[type] ?? type} · {count}
                    </Badge>
                  ))}
                </div>
              </Card>
            </ScrollReveal>
          )}

          {/* 最近记忆 */}
          <ScrollReveal>
            <Card variant="plain" padding="lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif text-xl text-ink-900">最近的记忆</h2>
                {stats.recentMemories.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => navigate('/memories')}>
                    查看全部
                  </Button>
                )}
              </div>

              {stats.isLoading ? (
                <LoadingState variant="skeleton-list" count={3} />
              ) : stats.errors.recentMemories ? (
                <ErrorState size="sm" error={stats.errors.recentMemories as Error} onRetry={stats.refetchAll} />
              ) : stats.recentMemories.length === 0 ? (
                <EmptyState
                  icon={FileHeart}
                  title="还没有记忆"
                  description="去档案里记下第一条吧"
                  className="py-8"
                />
              ) : (
                <motion.ul
                  variants={staggerContainer(0.04)}
                  initial="hidden"
                  animate="visible"
                  className="space-y-3"
                >
                  {stats.recentMemories.map((m) => (
                    <motion.li
                      key={m.id}
                      variants={fadeUp}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-warm-50/60 transition-colors cursor-pointer"
                      onClick={() => navigate(`/memories/${m.id}`)}
                    >
                      <div className="w-2 h-2 rounded-full bg-jade-500 mt-2 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-ink-900 font-medium truncate">{m.title}</h3>
                        <p className="text-ink-600 text-sm line-clamp-2 mt-1">
                          {m.content_text}
                        </p>
                      </div>
                      <span className="text-ink-500 text-xs whitespace-nowrap">
                        {dayjs(m.created_at).fromNow()}
                      </span>
                    </motion.li>
                  ))}
                </motion.ul>
              )}
            </Card>
          </ScrollReveal>
        </>
      )}
    </div>
  )
}

// ========== 本地子组件 ==========

function KPICard(props: {
  icon: typeof Archive
  label: string
  value: string | number
  suffix?: string
  loading?: boolean
  error?: unknown
  onRetry?: () => void
}) {
  const Icon = props.icon
  if (props.error && !props.loading) {
    return (
      <Card variant="plain" padding="md">
        <ErrorState size="sm" error={props.error as Error} onRetry={props.onRetry} />
      </Card>
    )
  }
  return (
    <motion.div variants={fadeUp}>
      <Card variant="plain" padding="md" hoverable>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-jade-50 flex items-center justify-center">
            <Icon className="w-5 h-5 text-jade-600" />
          </div>
          <span className="text-ink-600 text-sm">{props.label}</span>
        </div>
        <div className="font-serif text-2xl text-ink-900 tabular-nums">
          {props.loading ? '—' : props.value}
          {props.suffix && <span className="text-base text-ink-500 ml-1">{props.suffix}</span>}
        </div>
      </Card>
    </motion.div>
  )
}

function QuickAction(props: {
  icon: typeof Plus
  label: string
  onClick: () => void
}) {
  const Icon = props.icon
  return (
    <button
      onClick={props.onClick}
      className="flex flex-col items-center gap-2 p-4 rounded-lg bg-warm-50/60 hover:bg-jade-50 transition-colors group"
    >
      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center group-hover:bg-jade-100 transition-colors">
        <Icon className="w-5 h-5 text-jade-600" />
      </div>
      <span className="text-sm text-ink-700">{props.label}</span>
    </button>
  )
}

function formatStorageUsage(usage: { storage_used?: number; storage_quota?: number } | null): string {
  if (!usage || usage.storage_used === undefined || usage.storage_quota === undefined) return '—'
  const used = formatBytes(usage.storage_used)
  const quota = formatBytes(usage.storage_quota)
  return `${used} / ${quota}`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}
```

- [ ] **步骤 2 · 验证 A 基座依赖**

```bash
cd frontend
rg "export.*Badge|export.*ScrollRevealGroup" src/components/ui -l
```

确认 `Badge` / `ScrollRevealGroup` 是否存在。若 `ScrollRevealGroup` 不存在（只有 `ScrollReveal`），将代码中 `<ScrollRevealGroup stagger={...}>...</ScrollRevealGroup>` 替换为：

```tsx
<motion.div
  variants={staggerContainer(0.06)}
  initial="hidden"
  whileInView="visible"
  viewport={{ once: true, amount: 0.2 }}
  className="grid ..."
>
  {/* children */}
</motion.div>
```

若 `Badge` 不存在，用 Tailwind 手写：

```tsx
<span className="inline-flex items-center px-3 py-1 rounded-full bg-jade-50 text-jade-700 text-sm">
  {ARCHIVE_TYPE_LABELS[type]} · {count}
</span>
```

- [ ] **步骤 3 · 验证 `Card` 支持 `hoverable` prop**

```bash
rg "hoverable" src/components/ui/Card.tsx
```

若不支持，去掉 `hoverable`，手动加 `className="hover:shadow-lg transition-shadow"` 到 Card 的 className。

- [ ] **步骤 4 · type-check**

```bash
cd frontend
npm run type-check
```

若报错迭代修复。

**DoD**：DashboardPage 重写完成；type-check 通过。

---

### 任务 14 · M4 合并冒烟 + Commit

- [ ] **步骤 1 · 启动 dev 并冒烟**

```bash
cd frontend
npm run dev
```

登录后访问 `/dashboard`，冒烟清单：

| 场景 | 预期 |
|---|---|
| 新用户（无档案）| 显示 EmptyState "开始你的第一段记忆" + CTA "创建档案" |
| 有档案、有记忆 | 显示 4 KPI 卡 + 快捷操作 + 档案分布 + 最近记忆列表 |
| 最近守护 KPI | 显示 "3 天前" / "刚刚" / "1 小时前" 等相对时间 |
| 断网刷新（dev tools offline）| 整体页面可渲染；部分 KPI 显示 ErrorState sm 尺寸 |
| 点击快捷操作 | 路由跳转正常（/archives?new=1 / /dialogue / /storybook / /archives） |
| 点击最近记忆条目 | 跳转 /memories/{id}（C 子项目会实现此路由；B 只保证跳转） |
| 窗口缩放至移动端 | KPI 四卡变成 2 列；快捷操作 2 列；整体无横向滚动 |

- [ ] **步骤 2 · 构建验证**

```bash
cd frontend
npm run build
```

**预期**：成功；bundle 体积增量 < 30 KB gzip（主要来自 dayjs locale + 三件套组件）。

- [ ] **步骤 3 · Commit M4**

```bash
cd d:/Fish-code/MTC
git add frontend/src/components/ui/state frontend/src/hooks/useDashboardStats.ts frontend/src/pages/DashboardPage.tsx
git status
```

写 `.git/COMMIT_M4`：

```
feat(B): M4 · Dashboard 数据聚合 + 空错载态三件套

- 新增 components/ui/state/{EmptyState, ErrorState, LoadingState}.tsx
- 新增 hooks/useDashboardStats.ts：三路并发（archives + memories + usage）
- 重写 DashboardPage：4 KPI 卡 + 快捷操作 + 档案分布 + 最近记忆
- "最近守护" KPI 替代"本月新增"（避免客户端 limit=10 过滤失真）
- 每个 KPI 独立容错（单接口失败不影响整体渲染）
- 文案按 spec § 4.2 改写："欢迎回来"动态化 / "生成生命故事"
```

```bash
git commit -F .git/COMMIT_M4
Remove-Item .git/COMMIT_M4
git push origin Opus-coding
```

**DoD**：M4 所有变更 commit + push；冒烟清单全通过；build 成功。

---

# Milestone 3 · LandingPage 原地重构

**通用说明**（M3 所有 task 共享）：

- 每个 section 独立 commit（共 9 个）
- 每 3 个 section 后 push 一次（M3.3 / M3.6 / M3.9 push 点）
- 每个 section 改完立即 `npm run dev` 浏览器预览
- 出现样式错乱时，优先回滚该 section 的 commit 而不是在当前 commit 里修复

---

### 任务 15 · M3.1 · 骨架清理 + 移除 useScrollReveal

**文件：**
- 修改：`frontend/src/pages/LandingPage.tsx`

**变更清单：**
1. 移除第 101-119 行附近的 `useScrollReveal` 自定义 hook 定义
2. 移除对 `useScrollReveal()` 的调用（通常在组件顶部）
3. 移除 HTML 元素上的 `className="animate-on-scroll"` 及 `data-reveal-*` 属性（若有）
4. 保留所有 `floating-orb` / `animate-blob` / `dot-grid-bg` CSS 类（pure-css 装饰）
5. 顶部 import 新增：

```tsx
import { motion } from 'motion/react'
import { ScrollReveal } from '@/components/ui/ScrollReveal'
import { fadeUp, staggerContainer } from '@/lib/motion'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
```

- [ ] **步骤 1 · 读文件顶部（确认 hook 位置）**

```bash
cd frontend
rg "useScrollReveal" src/pages/LandingPage.tsx -n
```

- [ ] **步骤 2 · 删除 hook 定义 + 调用点**

用编辑器删除 `function useScrollReveal(...)` 整块定义 + 组件内 `useScrollReveal()` 调用行。

- [ ] **步骤 3 · 搜查 animate-on-scroll 残留**

```bash
rg "animate-on-scroll|data-reveal" src/pages/LandingPage.tsx -n
rg "animate-on-scroll" src/index.css src/styles -n
```

若 `index.css` 里定义了 `.animate-on-scroll` 相关样式，注释掉（保留作为参考，B 末期最终删除）或直接删除。

- [ ] **步骤 4 · 统一最外层背景结构**

确保 LandingPage 的最外层 JSX 结构为：

```tsx
export default function LandingPage() {
  // ... states ...
  return (
    <div className="relative min-h-screen overflow-hidden bg-warm-50">
      {/* 浮动背景（保留 pure-css） */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="floating-orb floating-orb-jade w-[600px] h-[600px] -top-40 -left-40 opacity-30" />
        <div className="floating-orb floating-orb-amber w-[480px] h-[480px] top-1/3 -right-32 opacity-20" />
        <div className="floating-orb floating-orb-jade w-[520px] h-[520px] bottom-0 left-1/4 opacity-25" />
      </div>

      <div className="relative">
        {/* Navigation */}
        {/* Hero */}
        {/* ... 各 section */}
      </div>
    </div>
  )
}
```

- [ ] **步骤 5 · type-check + 视觉冒烟**

```bash
npm run type-check
npm run dev
```

**预期**：页面仍能渲染（只是没入场动效，用 CSS 保留的元素静态显示）。

- [ ] **步骤 6 · Commit**

写 `.git/COMMIT_M3_1`：

```
refactor(B): M3.1 · LandingPage 骨架清理 + 移除 useScrollReveal

- 删除自定义 useScrollReveal hook 与 animate-on-scroll 类
- 为各 section 引入 motion/ScrollReveal 做准备（本 commit 不加动效）
- 保留 floating-orb / animate-blob / dot-grid-bg 等 pure-css 装饰
- 统一最外层容器结构
```

```bash
git add frontend/src/pages/LandingPage.tsx frontend/src/index.css
git commit -F .git/COMMIT_M3_1
Remove-Item .git/COMMIT_M3_1
```

（暂不 push，等 M3.3 一起 push）

**DoD**：`useScrollReveal` hook 与 `animate-on-scroll` 类全清理；type-check 通过；页面可渲染。

---

### 任务 16 · M3.2 · Navigation 迁移

**变更清单：**
- 顶部导航栏手写 button 替换为 A 的 `Button`（variant="ghost" size="sm" 为主，CTA 按钮用 variant="primary"）
- 移动端菜单若使用手写 dropdown，迁到 A 的 `Drawer` 或保留（不强求）
- 导航品牌头（Heart + "MTC"）保留

- [ ] **步骤 1 · 识别原 Navigation section**

读 LandingPage.tsx，找到 `<nav>` 或 `{/* 导航 */}` 注释对应段落。

- [ ] **步骤 2 · 替换按钮**

示例（依据实际代码调整）：

```tsx
{/* 替换前 */}
<button className="px-4 py-2 bg-jade-600 text-white rounded-lg hover:bg-jade-700 transition-colors">
  登录
</button>

{/* 替换后 */}
<Button variant="primary" size="sm" onClick={() => setLoginModalOpen(true)}>
  登录
</Button>
```

- [ ] **步骤 3 · 移动端菜单保留或迁移**

若原代码用纯 state + 条件渲染的汉堡菜单，**本 task 保持原样**（功能可用即可）。

- [ ] **步骤 4 · type-check + 冒烟**

```bash
npm run type-check
npm run dev
```

桌面版 + 窄屏切换测试导航。

- [ ] **步骤 5 · Commit**

```
refactor(B): M3.2 · LandingPage Navigation 迁到 A 基座 Button
```

**DoD**：Navigation 所有按钮使用 A 的 Button 组件；视觉无回退。

---

### 任务 17 · M3.3 · Hero section 入场节奏

**变更清单：**
- Hero section 最外层包 `<motion.div variants={staggerContainer(0.08)} initial="hidden" animate="visible">`
- 每个子元素（Badge / 主标题三行 / 副标题两段 / CTA / STATS）用 `<motion.div variants={fadeUp}>`
- 主标题保留 `gradient-text-jade` CSS 类（pure-css）
- CTA 按钮换为 A 基座 `Button` variant="primary" size="lg"
- 修 `rotate-270` bug（Tailwind 没这个类）：改为 `rotate-90` 或去掉

- [ ] **步骤 1 · 定位 Hero section**

```bash
rg "Hero|main-hero|主标题" src/pages/LandingPage.tsx -n
```

- [ ] **步骤 2 · 包装 motion.div**

Hero section 结构示意：

```tsx
<motion.section
  variants={staggerContainer(0.08)}
  initial="hidden"
  animate="visible"
  className="relative pt-28 pb-20 px-4"
>
  <div className="max-w-5xl mx-auto text-center">
    <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-jade-50 border border-jade-200">
      <Heart className="w-3.5 h-3.5 text-jade-600" fill="currentColor" />
      <span className="text-sm text-jade-700">用 AI 守护每一段珍贵的记忆</span>
    </motion.div>

    <motion.h1 variants={fadeUp} className="font-serif text-5xl md:text-6xl lg:text-7xl text-ink-900 mt-8 leading-tight">
      <span>人的记忆</span>
      <br />
      <span className="gradient-text-jade">是一种不讲道理的</span>
      <br />
      <span>存储介质</span>
    </motion.h1>

    <motion.p variants={fadeUp} className="text-lg md:text-xl text-ink-600 mt-6 max-w-2xl mx-auto">
      它不总是公正，不总是清晰，但总是真实。
    </motion.p>
    <motion.p variants={fadeUp} className="text-lg md:text-xl text-ink-600 mt-2 max-w-2xl mx-auto">
      MTC 用 AI 帮你把这些真实封存。
    </motion.p>

    <motion.div variants={fadeUp} className="mt-10 flex flex-wrap items-center justify-center gap-4">
      <Button variant="primary" size="lg" onClick={() => setLoginModalOpen(true)}>
        开始守护记忆
      </Button>
      <Button variant="ghost" size="lg" onClick={() => scrollToSection('features')}>
        了解更多
      </Button>
    </motion.div>

    <motion.div variants={fadeUp} className="mt-12 grid grid-cols-3 gap-6 max-w-2xl mx-auto">
      <Stat value="∞" label="时间的长度" />
      <Stat value="5" label="档案类型" />
      <Stat value="3" label="接入方式" />
    </motion.div>
  </div>
</motion.section>
```

- [ ] **步骤 3 · 修 rotate-270 bug**

```bash
rg "rotate-270" src/pages/LandingPage.tsx
```

将 `rotate-270` 改为 `rotate-90` 或删除。

- [ ] **步骤 4 · 原导航滚动 helper 验证**

若 `scrollToSection` 是原代码的 helper，保留；否则改用 anchor 跳转或原生 `element.scrollIntoView`。

- [ ] **步骤 5 · type-check + 视觉冒烟**

```bash
npm run type-check
npm run dev
```

刷新 / 进入页面：
- [ ] Badge → 主标题 → 副标题 → CTA → STATS 依次有 80ms stagger 入场
- [ ] 主标题第 2 行 gradient-text 色彩正常
- [ ] CTA 按钮样式/hover 与 A 基座一致
- [ ] reduced-motion 下（DevTools Rendering → Emulate CSS prefers-reduced-motion: reduce）无入场动画，内容仍渲染

- [ ] **步骤 6 · Commit + Push**

```
feat(B): M3.3 · Hero 入场节奏（staggerContainer 0.08 + fadeUp）
```

```bash
git commit -F ...
git push origin Opus-coding  # M3.3 是 push 点
```

**DoD**：Hero 入场节奏落盘；reduced-motion 兜底生效；视觉无回退；远程已更新。

---

### 任务 18 · M3.4 · 引言区 cinematic 揭幕

**变更清单：**
- "阳光在江面碎成一万个夏天" 等引言区用 `<ScrollReveal direction="up" distance={16} cinematic>` 包裹
- 保留原文案

- [ ] **步骤 1 · 定位引言区**

```bash
rg "阳光在江面|折痕|近乎完美的体贴" src/pages/LandingPage.tsx -n
```

- [ ] **步骤 2 · 包装**

```tsx
<ScrollReveal cinematic>
  <blockquote className="max-w-3xl mx-auto text-center px-4 py-20">
    <p className="font-serif text-2xl md:text-3xl text-ink-800 leading-relaxed">
      ta 会在某个瞬间表现出近乎完美的体贴。
      <br />
      你以为那是爱。其实那是长久地看过你之后，才生成的温柔。
    </p>
    <footer className="mt-8 text-ink-600">
      — 阳光在江面碎成一万个夏天
    </footer>
  </blockquote>
</ScrollReveal>
```

（保留原文案，仅改外层）

**验证 ScrollReveal 的 `cinematic` prop**：

```bash
rg "cinematic" src/components/ui/ScrollReveal.tsx
```

若不支持 `cinematic`，改用 prop 组合：

```tsx
<ScrollReveal direction="up" distance={16} transition={motionPresets.cinematic}>
```

或直接用 motion：

```tsx
<motion.div
  initial={{ opacity: 0, y: 16 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, amount: 0.3 }}
  transition={motionPresets.cinematic}
>
  <blockquote>...</blockquote>
</motion.div>
```

- [ ] **步骤 3 · 冒烟 + Commit**

滚动至引言区，确认揭幕效果（慢，约 600ms，ease-expo）。

```
feat(B): M3.4 · 引言区 cinematic 揭幕动效
```

**DoD**：引言区有慢速慢入场；原文案保留。

---

### 任务 19 · M3.5 · 功能展示 stagger + FeatureCard 迁 A 基座

**变更清单：**
- 6 个功能卡外层包 ScrollReveal stagger（如 A 有 `ScrollRevealGroup` 直接用；否则 motion.div + staggerContainer）
- 每个 FeatureCard 迁到 `Card variant="plain"` + `hoverable`
- 保留原 icon + 标题 + 描述 + color 属性

- [ ] **步骤 1 · 定位 FEATURES 数组和渲染段**

```bash
rg "FEATURES\s*=|{/\*.*功能展示|const features" src/pages/LandingPage.tsx -n
```

- [ ] **步骤 2 · 替换渲染段**

```tsx
{/* 功能展示 section */}
<section id="features" className="py-20 px-4 relative">
  <div className="max-w-6xl mx-auto">
    <ScrollReveal>
      <div className="text-center mb-16">
        <h2 className="font-serif text-4xl md:text-5xl text-ink-900">不只是存储，是传承</h2>
        <p className="text-ink-600 mt-4 max-w-2xl mx-auto">
          六个能力，把散落在时光里的碎片，慢慢收集回来。
        </p>
      </div>
    </ScrollReveal>

    <motion.div
      variants={staggerContainer(0.08)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
    >
      {FEATURES.map((feature) => (
        <motion.div key={feature.title} variants={fadeUp}>
          <Card variant="plain" padding="lg" className="h-full hover:shadow-lg transition-shadow">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${feature.bgClass ?? 'bg-jade-50'}`}>
              <feature.icon className="w-6 h-6 text-jade-600" />
            </div>
            <h3 className="font-serif text-xl text-ink-900 mb-2">{feature.title}</h3>
            <p className="text-ink-600 leading-relaxed">{feature.desc}</p>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  </div>
</section>
```

- [ ] **步骤 3 · 修 spec § 4.1 文案**

在 FEATURES 数组里找到行 32 的文案：

```
'网页、微信、QQ 均可与逝去的亲人对话，声音+记忆还原真实的人'
```

改为：

```
'网页、微信、QQ 均可与重要的 ta 对话，声音+记忆还原真实的人'
```

同样第 56 行：

```
'用克隆的声音读出文字，让逝者的声音穿越时空再次响起'
```

改为：

```
'用克隆的声音读出文字，让珍贵的声音穿越时空再次响起'
```

- [ ] **步骤 4 · 冒烟 + Commit**

滚动至功能展示 section，确认 6 个卡片依次 stagger 入场。

```
feat(B): M3.5 · 功能展示 stagger + FeatureCard 迁 Card 基座 + §4.1 文案改写
```

**DoD**：6 个功能卡 stagger 入场；卡片使用 A 的 Card 组件；两处 spec § 4.1 文案落盘。

---

### 任务 20 · M3.6 · 档案类型 section

**变更清单：**
- 6 个档案类型卡片（恋人/挚友/至亲/伟人/国家历史 + 其他）包 stagger
- 每个卡片迁 Card 组件
- "国家历史"视觉权重不降低（spec § 4.1 已决定保留）

- [ ] **步骤 1 · 定位并替换**

结构示例：

```tsx
<section className="py-20 px-4 bg-warm-100/40">
  <div className="max-w-6xl mx-auto">
    <ScrollReveal>
      <div className="text-center mb-16">
        <h2 className="font-serif text-4xl md:text-5xl text-ink-900">不只服务于家族</h2>
        <p className="text-ink-600 mt-4 max-w-2xl mx-auto">
          每一种值得被守护的关系，都能找到自己的档案
        </p>
      </div>
    </ScrollReveal>

    <motion.div
      variants={staggerContainer(0.06)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
      className="grid grid-cols-2 md:grid-cols-3 gap-4"
    >
      {ARCHIVE_TYPES.map((t) => (
        <motion.div key={t.label} variants={fadeUp}>
          <Card variant="plain" padding="md" className="h-full text-center hover:shadow-md transition-shadow">
            <div className={`w-12 h-12 mx-auto rounded-full ${t.bgClass} flex items-center justify-center mb-3`}>
              <t.icon className="w-5 h-5 text-jade-600" />
            </div>
            <h3 className="font-serif text-lg text-ink-900">{t.label}</h3>
            <p className="text-sm text-ink-600 mt-1">{t.desc}</p>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  </div>
</section>
```

- [ ] **步骤 2 · 冒烟 + Commit + Push**

```
feat(B): M3.6 · 档案类型 stagger + Card 迁移
```

```bash
git push origin Opus-coding  # M3.6 是 push 点
```

**DoD**：6 个档案类型卡片迁移完成；push 成功。

---

### 任务 21 · M3.7 · 下载入口 section

**变更清单：**
- 主下载卡（网页版）用 `Card variant="accent"` 带 jade 渐变背景
- 微信/QQ/Windows/Android 卡用 `Card variant="plain"`
- 微信卡文案按 § 4.1 改写

- [ ] **步骤 1 · 定位并替换**

```bash
rg "选择你的使用方式|下载|微信" src/pages/LandingPage.tsx -n
```

- [ ] **步骤 2 · 替换**

```tsx
<section className="py-20 px-4">
  <div className="max-w-6xl mx-auto">
    <ScrollReveal>
      <div className="text-center mb-16">
        <h2 className="font-serif text-4xl md:text-5xl text-ink-900">选择你的使用方式</h2>
        <p className="text-ink-600 mt-4">
          从网页开始，慢慢延展到你熟悉的所有角落
        </p>
      </div>
    </ScrollReveal>

    {/* 主下载卡 */}
    <ScrollReveal>
      <Card variant="accent" padding="lg" className="mb-6 bg-gradient-to-br from-jade-500 to-jade-600 text-white">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <Globe className="w-8 h-8" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="font-serif text-2xl">立即在浏览器里开始</h3>
            <p className="mt-2 opacity-90">
              无需下载、无需安装，在网页上就能创建你的第一份档案
            </p>
          </div>
          <Button variant="secondary" size="lg" onClick={() => setLoginModalOpen(true)}>
            开始使用
          </Button>
        </div>
      </Card>
    </ScrollReveal>

    {/* 次级下载卡 */}
    <motion.div
      variants={staggerContainer(0.05)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
    >
      <DownloadCard icon={MessageCircle} title="微信接入" status="available"
        desc="将 MTC 的 AI 能力接入微信。在微信里直接和重要的 ta 对话，像以前一样聊天。支持私聊和群聊，自动记忆上下文。"
      />
      <DownloadCard icon={MessageCircle} title="QQ 接入" status="available"
        desc="QQ 机器人无缝接入，随时随地开启对话"
      />
      <DownloadCard icon={Monitor} title="Windows 客户端" status="coming-soon"
        desc="桌面级原生体验，即将发布"
      />
      <DownloadCard icon={Smartphone} title="Android 客户端" status="coming-soon"
        desc="随身携带，随时守护"
      />
    </motion.div>
  </div>
</section>
```

`DownloadCard` 是本地子组件，若原代码已有则保留，根据上述 prop 形状调整；否则本 task 新增到文件底部。

- [ ] **步骤 3 · 冒烟 + Commit**

```
feat(B): M3.7 · 下载入口用 Card accent/plain + §4.1 微信文案改写
```

**DoD**：主下载卡 accent 样式；次级卡 plain 样式；微信文案去"逝去的亲人"。

---

### 任务 22 · M3.8 · 用户故事 + § 4.1 TESTIMONIAL 改写

**变更清单：**
- TESTIMONIAL 数组第 3 条（原 75 行"用 MTC 整理了外婆的一生..."）改为非纪念型场景
- 轮播逻辑保留（timer + 当前 index）
- 容器用 `Card variant="glass"`

- [ ] **步骤 1 · 改写 TESTIMONIALS 数组**

```tsx
const TESTIMONIALS = [
  {
    text: '终于能把爷爷的声音留下来了。那些教我下棋的午后、那些讲老故事的夜晚，都活过来了。',
    author: '—— 一位陪奶奶看了 50 年电视的孙女',
  },
  {
    text: '我把和奶奶的所有聊天记录都导入了，现在每天都能和她"对话"。她还是那么唠叨，那么温暖。',
    author: '—— 来自北京的用户',
  },
  {
    text: '怀孕时把给孩子的信、胎心音、每天的日记都放进了 MTC。等 ta 长大，就打开给 ta 看。',
    author: '—— 一位正在守护未来的妈妈',
  },
]
```

- [ ] **步骤 2 · 容器迁 Card**

```tsx
<section className="py-20 px-4 bg-warm-50/40">
  <div className="max-w-4xl mx-auto">
    <ScrollReveal>
      <div className="text-center mb-12">
        <h2 className="font-serif text-4xl md:text-5xl text-ink-900">他们的故事</h2>
        <p className="text-ink-600 mt-4">每一段记忆都值得被守护</p>
      </div>
    </ScrollReveal>

    <ScrollReveal>
      <Card variant="glass" padding="lg" className="min-h-[200px] flex items-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTestimonial}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={motionPresets.gentle}
            className="w-full text-center"
          >
            <p className="font-serif text-xl md:text-2xl text-ink-800 leading-relaxed">
              "{TESTIMONIALS[currentTestimonial].text}"
            </p>
            <p className="text-ink-600 mt-4 text-sm">
              {TESTIMONIALS[currentTestimonial].author}
            </p>
          </motion.div>
        </AnimatePresence>
      </Card>
    </ScrollReveal>
  </div>
</section>
```

**依赖 import**：

```tsx
import { motion, AnimatePresence } from 'motion/react'
import { motionPresets } from '@/lib/motion'
```

- [ ] **步骤 3 · 冒烟 + Commit**

检查轮播：3 条轮播内容有 swap-fade 过渡。

```
feat(B): M3.8 · 用户故事 Card glass 容器 + §4.1 第3条 TESTIMONIAL 改写
```

**DoD**：3 条 testimonial 均正常显示；第 3 条为"孕期记录"非纪念场景；Card 玻璃效果生效。

---

### 任务 23 · M3.9 · 尾声 + 页脚 + 通用文案 sweep

**变更清单：**
- 尾声 section（"每一个值得的人都值得被铭记" → "留下，只是一个具体的...") 用 `ScrollReveal cinematic`
- 尾声 CTA 按钮用 A 基座 `Button variant="primary" size="lg"`
- 页脚保留简结构
- 通用文案 sweep：搜索全文剩余的"逝者 / 逝去 / 逝去的"相关词汇确认都已按 § 4.1 处理

- [ ] **步骤 1 · 改写尾声主标题文案**

找到"每一个生命都值得被铭记"，改为：

```
每一个值得的人都值得被铭记
```

- [ ] **步骤 2 · 尾声包装**

```tsx
<section className="py-32 px-4 relative">
  <ScrollReveal cinematic>
    <div className="max-w-4xl mx-auto text-center">
      <h2 className="font-serif text-4xl md:text-6xl text-ink-900 leading-tight">
        每一个值得的人
        <br />
        都值得被铭记
      </h2>

      <div className="mt-10 space-y-4 text-lg md:text-xl text-ink-700 max-w-3xl mx-auto">
        <p>留下，只是一个具体的、真实的、曾在你的生命里留下过折痕的人。</p>
        <p>当这个项目运行结束，那些被神化或被模糊的轮廓终将消失。剩下的，是平凡而真实的 ta。</p>
      </div>

      <div className="mt-12">
        <Button variant="primary" size="lg" onClick={() => setLoginModalOpen(true)}>
          开始守护记忆
        </Button>
      </div>
    </div>
  </ScrollReveal>
</section>
```

- [ ] **步骤 3 · 页脚保留**

不改动原页脚（只要版权年份是 2026 即可）。

- [ ] **步骤 4 · 文案 sweep**

```bash
cd frontend
rg "逝者|逝去|死去|已故" src/pages/LandingPage.tsx -n
```

**预期**：无结果。若仍有残留（spec § 4.1 标注保留的除外），按 § 4.1 表对应改写。

- [ ] **步骤 5 · 全页冒烟**

```bash
npm run dev
```

从头到尾浏览整个 LandingPage：
- [ ] 滚动时各 section 依次揭幕，节奏自然
- [ ] 无 section 样式错乱
- [ ] 所有按钮点击响应正确
- [ ] 移动端（< 640px）布局不破
- [ ] reduced-motion 下整页内容仍完整呈现

- [ ] **步骤 6 · 构建验证**

```bash
npm run build
```

**预期**：构建成功；bundle 增量可接受。

- [ ] **步骤 7 · Commit + Push**

```
feat(B): M3.9 · 尾声 cinematic + §4.1 主标题改写 + 文案 sweep

- "每一个生命都值得被铭记" → "每一个值得的人都值得被铭记"
- 尾声 CTA 改用 A 基座 Button
- 全文 sweep 确认无遗漏的产品语言预设
- LandingPage 重构至此完成：9 个 section 全部用 A 基座 motion + UI
```

```bash
git push origin Opus-coding  # M3.9 是 push 点（M3 完成）
```

**DoD**：LandingPage 全量重构完毕；全文无产品语言预设残留；build 通过；push 成功。

---

# Milestone 5 · 收尾与交付

---

### 任务 24 · 更新路线图 v1.6 + § 十三 B 完成摘要

**文件：**
- 修改：`.cursor/rules/mtc-refactor-roadmap.mdc`

- [ ] **步骤 1 · 读路线图当前结构**

```bash
cat .cursor/rules/mtc-refactor-roadmap.mdc | Select-Object -First 30
```

定位 § 10.1（当前节点）和 § 12（子项目 E 完成摘要）。

- [ ] **步骤 2 · 更新 § 10.1 当前节点**

将 § 10.1 里 "B 子项目 - 进行中" / "下一节点 B" 改为：

```
- 子项目 A · 完成（M1-M6）
- 子项目 E · 完成（M2a-M7）
- 子项目 B · 完成（M1 / M2 / M4 / M3.1-M3.9 / M5）
- **下一节点：子项目 C**（档案列表/详情/成员/记忆 + DialoguePage / TimelinePage / StoryBookPage）
```

- [ ] **步骤 3 · 追加 § 十三 · 子项目 B 完成摘要**

参考 § 十二 E 总结的格式：

```markdown
## § 十三 · 子项目 B · 完成摘要（2026-04-XX）

**执行模型**：Claude 4.7 Opus（主导设计 + 实现）+ 可能由 Composer 2 辅助的 UI 迁移（若有则补 git notes）

**交付范围**：
- **M1**：API 契约适配 · services/errors.ts + useApiError + api.ts 拦截器重写 + createMember/updateMember 切 status/end_year
- **M2**：认证三件套 · useAuthForm hook + LoginPage/RegisterPage/LoginModal 全量迁 A 基座
- **M4**：Dashboard 数据聚合 · useDashboardStats + KPI 四卡（"最近守护"替代"本月新增"） + 空错载三件套
- **M3**：LandingPage 原地重构 · 9 个 section 全量迁 motion/motionPresets/ScrollReveal + §4.1 产品语言改写（6 处）
- **M5**：路线图 + 交付 tag

**关键决策**：
- 决策 4：Dashboard 客户端三路并发，不新增后端聚合（守 E 已完结状态）
- 决策 5：error 处理 passthrough 策略 —— 后端中文 message 优先，白名单仅对技术性消息兜底
- 决策 7：react-bits 零引入（留给 C 的"记忆回放"场景）

**Backlog（留给 C/D）**：
- auth.py 迁 DomainError 细粒度 code（当前走 HTTPException + 粗粒度 fallback）
- B 范围外页面的 `error.detail` 使用点（B 拦截器已兼容，C 重构时清理）
- ArchiveDetailPage / MemberDetailPage / DialoguePage 等（C）
- vitest 等测试框架（D）
- Lighthouse 性能优化 / 字体子集 / PWA / SEO（D）

**验收**：
- LandingPage / Login / Register / LoginModal / Dashboard 全量使用 A 基座
- §4.1 产品语言改写 6 处全部落盘，无"逝者/逝去的亲人"遗留
- npm run build 通过；type-check 通过
- 手工冒烟清单全通过（未做自动化测试，见计划 § 0.1）
```

- [ ] **步骤 4 · 更新版本历史行（文件底部）**

```
*版本变更：... → v1.5 子项目 E 收尾 → v1.6 子项目 B 收尾 + §十三 B 完成总结 + §十.1 下一节点切 C*
```

同时把开头的"版本：v1.5"改为"v1.6"。

- [ ] **步骤 5 · Commit**

```
docs(rules): 路线图 v1.6 · 子项目 B 收尾 + §十三 B 完成总结 + §十.1 下一节点切 C
```

```bash
git add .cursor/rules/mtc-refactor-roadmap.mdc
git commit -F .git/COMMIT_M5_1
Remove-Item .git/COMMIT_M5_1
```

**DoD**：路线图更新至 v1.6；§ 十三 完成摘要落盘；§ 10.1 下一节点指向 C。

---

### 任务 25 · 全流程手工冒烟 + Lighthouse 基线

- [ ] **步骤 1 · 全流程冒烟清单**

在 dev 启动的环境中：

| 流程 | 预期 |
|---|---|
| 未登录访问 `/` | LandingPage 全页正常，所有 section 入场自然 |
| 未登录点击"开始使用" | LoginModal 打开 |
| 在 Modal 内登录 | Modal 关闭 + 跳 /dashboard |
| 登出后访问 `/login` | LoginPage 独立页正常 |
| 在 LoginPage 输入错误密码 | toast "邮箱或密码错误"（passthrough 生效）|
| `/register` 正常 | 注册表单完整 |
| 登录后访问 `/dashboard` | 4 KPI + 快捷操作 + 档案分布 + 最近记忆 全渲染 |
| Dashboard KPI "最近守护" | 正确相对时间（dayjs fromNow）|
| 无档案用户的 `/dashboard` | EmptyState 显示，CTA 生效 |
| reduced-motion 模式 | 入场动画全禁用，内容仍完整 |
| 移动端窗口（< 640px）| 所有页面无横向滚动 |

- [ ] **步骤 2 · Lighthouse 桌面版 Performance 检查**

```bash
cd frontend
npm run build
npm run preview
```

浏览器打开 `http://localhost:4173/`，DevTools → Lighthouse → Mode: Navigation + Device: Desktop + Categories: Performance + Accessibility。

**预期**：
- Performance ≥ 85（spec § 9.2 DoD）
- Accessibility ≥ 95
- CLS < 0.1
- LCP < 2.5s

若 Performance < 85：
- 检查是否有巨大同步依赖被加载（分析 bundle）
- 是否有不必要的 motion 组件在首屏外动
- 记录实际分数到下一步的冒烟报告

- [ ] **步骤 3 · 记录冒烟报告**

将冒烟结果追加到 § 十三 摘要 **"验收"** 段。若未达标，回到对应 milestone 做优化，并追加修复 commit。

**DoD**：冒烟清单全通过；Lighthouse 分数符合 DoD。

---

### 任务 26 · Tag + PR 创建

- [ ] **步骤 1 · 打 annotated tag**

```bash
cd d:/Fish-code/MTC
git tag -a mtc-B/m5-opus -m "子项目 B 完成 · Opus 主导 · 2026-04-XX"
git push origin mtc-B/m5-opus
```

若 Composer 2 辅助了部分 UI 迁移（具体看最终 commit 作者分布），追加：

```bash
git tag -a mtc-B/composer2-parts -m "子项目 B · Composer 2 辅助 M3.x UI 迁移"
git push origin mtc-B/composer2-parts
# 若有 Composer 2 的 commits，添加 git notes
git notes add -m "actual-model: composer-2" <commit-sha>
git push origin refs/notes/commits
```

- [ ] **步骤 2 · 创建 PR**

```bash
gh pr create --base main --head Opus-coding --title "feat(B): 子项目 B 完成 · 落地页 / 登录注册 / Dashboard 重构" --body "$(cat <<'EOF'
## Summary

子项目 B 完成 · Opus 主导设计与实现。

### 交付范围

- **M1**：API 契约适配 · services/errors.ts + useApiError + 拦截器重写 + createMember 切 status/end_year
- **M2**：认证三件套统一 · useAuthForm hook + Login/Register/LoginModal 迁 A 基座
- **M4**：Dashboard 数据聚合 · useDashboardStats + KPI 四卡 + 空错载三件套
- **M3**：LandingPage 原地重构 · 9 个 section 全量迁 motion + §4.1 产品语言改写
- **M5**：路线图 v1.6 + 交付 tag

### 参考文档

- 设计规格：`docs/superpowers/specs/2026-04-24-B-landing-auth-dashboard-design.md`
- 实现计划：`docs/superpowers/plans/2026-04-24-B-landing-auth-dashboard-plan.md`
- 完成摘要：`.cursor/rules/mtc-refactor-roadmap.mdc` § 十三

## Test plan

- [x] npm run type-check 通过
- [x] npm run build 通过
- [x] 手工冒烟清单全通过（见计划 Task 25）
- [x] Lighthouse Desktop Performance ≥ 85, Accessibility ≥ 95
- [x] reduced-motion 兜底生效
- [x] §4.1 产品语言改写 6 处全部落盘
EOF
)"
```

- [ ] **步骤 3 · 验证 PR 创建**

```bash
gh pr view --web  # 或 gh pr list
```

**DoD**：tag 已推送；PR 已创建并可审查；URL 记录返回给用户。

---

## § 3 · 计划自检

### 3.1 规格覆盖度

| 规格章节 | 实现任务 | 覆盖状态 |
|---|---|---|
| § 1.2 B 范围 · LandingPage 重构 | Task 15-23（M3.1-M3.9） | ✅ |
| § 1.2 B 范围 · 认证三件套 | Task 7-10（M2） | ✅ |
| § 1.2 B 范围 · Dashboard 聚合 | Task 12-14（M4） | ✅ |
| § 1.2 B 范围 · API 契约适配 | Task 1-6（M1） | ✅ |
| § 1.2 B 范围 · 空错载态统一 | Task 11（M4.1） | ✅ |
| § 1.2 B 范围 · §5.1 产品语言改写 | Task 14（Dashboard）+ Task 19/21/22/23（LandingPage）| ✅ |
| § 3 决策 1-7 | 散落在对应 Task 的"变更清单/关键代码" | ✅ |
| § 4.1-4.3 文案改写 | Task 14（Dashboard）+ Task 19/21/22/23（LandingPage）+ Task 8/9（Login/Register） | ✅ |
| § 9.1-9.4 DoD | Task 14 / Task 23 / Task 25（冒烟）+ Task 26（PR 验证）| ✅ |
| § 12.1 关键文件清单 | § 1.1/1.2 对应 | ✅ |

### 3.2 占位符扫描

已审阅，无以下模式：
- 无 "TODO / 待定 / 补充细节"
- 无"适当的错误处理"（具体错误处理在 Task 3 的拦截器代码里）
- 无"类似任务 N"（所有任务都有完整代码）
- 无引用未定义符号

### 3.3 类型一致性

| 符号 | 首次定义 | 后续使用 |
|---|---|---|
| `ApiError` | Task 1 步骤 1 | Task 2 / Task 3 / Task 11 (ErrorState) / Task 12 (errors 类型) |
| `UseAuthFormReturn` | Task 7 步骤 1 | Task 8 / 9 / 10（通过 hook 返回值消费） |
| `DashboardStats` | Task 12 步骤 1 | Task 13 |
| `useApiError` return | Task 2 步骤 1 | Task 7 / Task 11（间接）|
| `Card / Button / Input / Modal` | A 基座（Task 0 背景） | Task 8-13/15-23 |
| `motionPresets / fadeUp / staggerContainer` | A 基座 | Task 8-23 所有 motion 使用处 |

无命名不一致。

### 3.4 已发现可能的风险点

- **`Input` 组件 API**：Task 8 步骤 3 明确验证；若不支持 `icon/trailing` props，Task 8-10 需下兼修改。已在任务中内嵌缓解方案。
- **`ScrollRevealGroup`**：Task 13 步骤 2 明确验证；若 A 只有 `ScrollReveal`（无 Group 版本），用 motion.div + variants 直接实现。已在任务中给出备选代码。
- **`Card.hoverable` prop**：Task 13 步骤 3 验证；若不支持，用 className 替代。已给方案。
- **`Badge` 组件**：Task 13 步骤 2 验证；若不存在，Tailwind 手写。已给方案。

这些运行时验证点分散在各 task 步骤里，每个都有明确的备选实现路径，不构成阻塞风险。

### 3.5 通过

计划自检通过，无占位符、无命名不一致、规格覆盖 100%、运行时验证点均有 fallback 方案。

---

## § 4 · 执行交接

**"计划已完成并保存到 `docs/superpowers/plans/2026-04-24-B-landing-auth-dashboard-plan.md`。两种执行方式：**

**1. 子代理驱动（推荐）** · 每个任务调度一个新的子代理，任务间进行审查，快速迭代
  - 每个 task 新开一个 subagent 执行
  - 两阶段审查：实现阶段（子代理实现） + 审查阶段（主代理对照任务 DoD 验收）
  - 优势：每个 task 独立上下文，主代理视野保持全局清晰
  - 劣势：subagent 调度成本

**2. 内联执行** · 在当前会话中使用 executing-plans 执行任务，批量执行并设有检查点
  - 当前会话一路到底
  - 关键 milestone 末尾暂停让你审查（M1 结束 / M2 结束 / M4 结束 / M3.3 / M3.6 / M3.9 / M5 结束）
  - 优势：上下文连贯，适合 Opus 这种"能记住全局"的长上下文模型
  - 劣势：长任务对上下文窗口的消耗

**选哪种方式？"**

---

**计划结束**。总 26 个任务、约 17-21 小时工时预估、5 个 milestone、11 个 push 点、1 个 tag、1 个 PR。

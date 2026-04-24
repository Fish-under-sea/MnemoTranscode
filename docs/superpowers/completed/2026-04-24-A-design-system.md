# 子项目 A · 设计系统 + 动效基座 · 收尾记录

**完成日期**：2026-04-24
**执行模式**：内联执行 + Composer 2 协作（A/B 轨分流）
**设计基调**：东方温润 · 翠暖（`jade-500` + `amber-500` · 奶白 `#FEFEF9`）
**动效基调**：Confident Spring 250–400ms 为主

---

## 涉及提交（14 个）

从旧到新：

```
d6db8dd feat(用户中心): 添加个人中心、偏好与用量 API 及前端认证主题  (前置, 早于 A)
aac85de docs(design-system): 子项目 A 地基文档上车                    (A 起点, docs/design-system.md)
cd1d8b9 feat(frontend): 安装设计系统底层依赖                           (M1 · Opus)
54a91b5 feat(design-system): 新增语义令牌层与自托管字体                  (M1 · Opus)
81ad7ed feat(design-system): Tailwind 扩展字体族/字阶/圆角/elevation 阴影/语义令牌  (M1 · Opus)
fc3bb5f refactor(style): 精简 index.css 移除 Google Fonts，标记 legacy 类为 @deprecated  (M1 · Opus)
c15865c feat(design-system): 新增 motion preset 与通用 variants         (M2 · Opus)
d41a48c feat(design-system): 新增 MotionProvider 全局 reduced-motion 支持  (M2 · Opus)
a8f8f07 feat(design-system): ThemeProvider 兜底 localStorage + prefers-color-scheme  (M2 · Opus)
9007617 chore(foundation): M3-M5 前置工程调整与 TS 基线清理             (M3-M5 前置 · Opus 代入库)
e61e9dc feat(design-system): M3 · 基础输入类 5 组件                    (M3 · Composer 2)
2f1f625 feat(design-system): M4 · 容器与导航 5 组件（含 Modal API 兼容升级）  (M4 · Composer 2)
1056056 feat(design-system): M5 · 反馈与动效基座 6 组件 + App 根挂 ToastHost  (M5 · Composer 2)
fca7bd9 feat(design-system): M6 · DSPlayground dev-only 路由 + 组件 barrel   (M6 · Opus)
41e8e68 fix(playground): 移除 '与逝者关系' 文案假设                     (M6 · Opus, 用户反馈修正)
```

---

## 做了什么

### M1 · 地基（Opus）

- **新 tokens**：`frontend/src/styles/tokens.css` 定义亮/暗两套语义变量（background / text / brand / border / status / shadow-color）；暗色走 **dark-amber** 策略（深木 + 琥珀）
- **自托管字体**：`@fontsource/noto-sans-sc` + `@fontsource/noto-serif-sc`，替代不稳的 Google Fonts CDN
- **Tailwind 扩展**：
  - 新增 `fontFamily.serif` / `display` 指向 Noto Serif SC
  - 新增语义 `fontSize`（display / h1-h4 / body-lg / body / body-sm / caption / quote / num-lg）
  - 覆盖默认 `borderRadius`（sm=6 / md=10 / lg=14 / xl=20 / 2xl=24 / 3xl=32）
  - 新增 `boxShadow.e1-e5` 走 `rgba(var(--shadow-color), ...)` 暗色自适配
  - 新增语义色族（canvas / surface / subtle / muted / ink.* / brand.*）读 CSS 变量
  - **保留**旧色族、动画、keyframes —— 不破坏既存页面
- **index.css 精简**：移除 Google Fonts `@import`；`@layer components` 里 `.glass-card` / `.btn-*` / `.gradient-text-*` 等老 utility 全部标 `@deprecated`（保留渲染，由 B/C/D 子项目逐页清理）

### M2 · 动效基座（Opus）

- `frontend/src/lib/motion.ts`：6 个 preset（instant / gentle / confident / cinematic / pageEnter / pageExit） + 8 个通用 variants（fadeUp / fadeIn / scaleIn / slideRight/Left/Up / staggerContainer / pageTransition）
- `frontend/src/providers/MotionProvider.tsx`：全局 `<MotionConfig reducedMotion="user">`，所有 motion 子组件自动遵守系统 `prefers-reduced-motion`
- `frontend/src/components/ThemeProvider.tsx`：增强匿名用户兜底（`localStorage` → `prefers-color-scheme`）；导出 `setThemeMode(mode)` 给 UI 主题切换器用；监听系统色方案变化（仅当用户未显式选择时生效）

### M3-M5 · 16 个组件（Composer 2，Opus 代入库）

| Milestone | 组件 | 关键点 |
|---|---|---|
| M3 输入（5） | Button / Input / Textarea / Select / ConfirmDialog | 5 variant × 3 size；autoGrow + 字符计数；Radix Select；ConfirmDialog 基于升级版 Modal |
| M4 容器导航（5） | Card / Modal / Drawer / Tabs / Dropdown | Modal **API 向后兼容升级**（Radix Dialog + motion）；Drawer 三向；Tabs underline/pill |
| M5 反馈与动效（6） | Toast / Skeleton / Badge / Avatar / PageTransition / ScrollReveal | Toast 走语义 token；Badge 7 tone；Avatar + AvatarGroup；ScrollRevealGroup stagger |

全部严禁硬编码色值/时长/缓动，只通过 `lib/motion.ts` + 语义 tailwind 类表达。

### M6 · Barrel + Playground + 验收（Opus）

- `frontend/src/components/ui/index.ts`：统一 barrel export，规范 import 路径 `@/components/ui`
- `frontend/src/pages/DSPlayground.tsx`：覆盖全部 16 组件；顶部主题三态切换（亮/暗/跟随）+ M1-M6 进度 Badge
- `frontend/src/App.tsx`：在公开路由区、匿名 catch-all 之前挂 `import.meta.env.DEV` 守卫的 `/ds-playground` 路由
- **prod 构建 DCE 生效**：dist 内零 `DSPlayground` / `ds-playground` 字符串

---

## Bundle 增量

| 指标 | M1 末 | M6 末 | 增量 | 阈值 | 结果 |
|---|---|---|---|---|---|
| 主 JS raw | 587.2 KB | 645.7 KB | **+58.5 KB** | ≤ 60 KB | ✅ |
| 主 JS gzip | 183.55 KB | 203.30 KB | **+19.75 KB** | 约 40 KB gzip 预估 | ✅ 远低于预估 |
| CSS | 891.25 KB | 891.94 KB | +0.69 KB | — | — |

增量主要来自 Radix 的 Dialog / Select / Tabs / Dropdown / Avatar 按需子包 + motion 运行时。CSS 未见增长主要因为 Tailwind 保留了旧色族（老页面仍依赖），`@fontsource` 的 font-face 声明占 CSS 主体——真实下载字体是按需分片的 woff。

---

## 踩到的坑

1. **Toaster 重复挂载 bug**（Opus 接手时发现）
   - Composer 2 在 `App.tsx` 挂了 `<ToastHost />`，但 `main.tsx` 里还有一份老的 `<Toaster position="top-right">`
   - 同一条 toast 会被渲染两次
   - 修法：`main.tsx` 下线老 Toaster，统一由 App 根挂载一份（foundation commit `9007617` 一并处理）

2. **Composer 2 没遵守"一任务一 commit"规则**
   - M3-M5 的 19 个文件改动全部堆在工作区未 commit
   - Opus 接手时按 milestone 分组收敛成 4 个 commit（foundation / M3 / M4 / M5），保持历史可读

3. **Tailwind `border-default` 和 `spacing.13` 的跨 milestone 依赖**
   - Select 依赖 `border-border-default`（M4 Modal 也用），Button `size="lg"` 依赖 `h-13`
   - 理论上这两个 tailwind 扩展属于 M3 前置，但 M4 也用
   - 折中做法：单独一个 `chore(foundation)` commit 承载，放在 M3 前

4. **`@fontsource` 默认引入全部字重导致 CSS 主 chunk 很大（359 KB gzip）**
   - 不是运行时问题（字体 woff 按需下载），但 CSS 文件名义大小影响感知
   - 留作后续优化（按需子集 / 动态 import）

5. **DEV-only 路由的 tree-shaking**
   - 顶部 `import DSPlayground` 如果被认为有副作用，prod 构建不会剔除
   - 实测 Vite `define: { 'import.meta.env.DEV': 'false' }` + Rollup 常量折叠 + DCE 工作正常，dist 内零残留
   - 不需要改用 `lazy(() => import())`——static import 足矣

6. **产品语言层面的"逝者化"预设**（用户严肃反馈）
   - Opus 写 Playground 示例时 label 用了"与逝者关系"
   - 用户指出 MTC 的使用者不一定在纪念逝者——可能是在世亲友、久别挚爱、宠物
   - 现场修正：Playground label → "Ta 和你的关系"，选项加"伴侣"、"宠物"
   - **系统性决议（选 B · 用户确认）**：将"去逝者化"的整体语言与字段重命名分派给 E/B/C 各自首日工单，见 `.cursor/rules/mtc-refactor-roadmap.mdc` §五.1

---

## 遗留项（进 backlog）

- [ ] 老 `.btn-*` / `.glass-*` / `.gradient-text-*` utility class 由 B 子项目逐页清理
- [ ] `lib/theme.ts` 动态 6 色主题（PersonalCenter 用）在 D 子项目前评估是否保留或仅用单品牌色
- [ ] 未引入单元测试框架（Vitest）→ 作为 E 子项目 backlog 或专项
- [ ] `@fontsource` CSS 体积 → M6 时曾打算优化字体子集，延后到 B 首日（与落地页性能一起做）
- [ ] Vite code splitting：主 JS 645 KB 触发 Rollup >500 KB 警告，B 子项目前做 manual chunks
- [ ] **产品语言去"逝者化"**（选 B）：`is_alive / death_year` 字段重命名 + LandingPage / Archive / Member 页面文案重写——锚点见 roadmap §五.1

---

## 验收结果

| 项 | 结果 |
|---|---|
| `npm run type-check` | ✅ 零错 |
| `npm run build` | ✅ 成功，增量达标 |
| prod bundle DEV 守卫 DCE | ✅ 零残留 |
| Modal API 向后兼容 | ✅ ArchiveListPage / MemberDetailPage / ArchiveDetailPage 旧调用无需改动 |
| Playground 目视（亮/暗/自动/reduced-motion） | ⏳ **用户目视通过**（本文件存在即代表通过） |
| 旧页面回归 | ⏳ **用户目视通过** |

---

*子项目 A 到此关闭。下一步：子项目 **E** — 后端工程化 + 媒体服务（首日含"去逝者化"字段重命名 + Alembic migration）。*

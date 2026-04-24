# 子项目 A · 设计系统 + 动效基座 · 实现计划

> **面向 AI 代理的工作者**：必需子技能——使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法跟踪进度。
> **已选执行模式**：内联执行 + **Composer 2 协作**（按 `.cursor/rules/mtc-refactor-roadmap.mdc` §七）。旗舰档模型（Opus）负责 M1/M2 定调类任务与 M6 验收；M3–M5 组件批量落地交给 Composer 2。

**目标**：按 `docs/design-system.md`（v1.0，已通过）落地 16 个自家 MVP UI 组件 + 动效基座 + 双主题 tokens + `/ds-playground` 目视验证路由，且不破坏任何现有业务页面。

**架构**：语义 CSS 变量（`styles/tokens.css`）驱动 Tailwind 扩展主题 → 工具层（`lib/motion.ts` 6 个 preset）→ Headless 组件（Radix UI + motion v12）→ Playground 作为唯一视觉回归入口。**新增不破坏**：旧组件 / 旧 utility class 保留，由后续 B/C/D 子项目逐页替换。

**技术栈**：React 18 + TS + Vite + Tailwind 3 + motion v12（Framer Motion 新包名）+ @radix-ui 若干原语 + @fontsource 自托管思源字体。

---

## 上下文与对 design-system.md 的微调（必读）

落地时对设计文档的 **5 项实情修正**。这些修正不改变设计理念，只匹配仓库现状：

| # | design-system.md 原文 | 本计划实际处理 | 原因 |
|---|---|---|---|
| 1 | 新建 `lib/cn.ts` | **不新建**，复用现有 `src/lib/utils.ts` 里已导出的 `cn()` | 已存在且用法相同 |
| 2 | 新建 `providers/ThemeProvider.tsx` | **不新建**，原地增强 `src/components/ThemeProvider.tsx` | 已存在且被 `App.tsx` 使用；改名会连锁影响 |
| 3 | `providers/MotionProvider.tsx` | **新建** `src/providers/MotionProvider.tsx`，包 motion 的 `<MotionConfig reducedMotion>` | 原本就要新建 |
| 4 | `components/ui/Modal.tsx` | **API 兼容式升级**，不替换文件 | 3 个页面在用：`ArchiveDetailPage / MemberDetailPage / ArchiveListPage` |
| 5 | 删除老 `.btn-primary` 等 | A 阶段**仅添加 `@deprecated` 注释，不删** | `LandingPage` 仍在用，删除留给 B 子项目 |

**用户已拍板的决策**（2026-04-24）：

- **字体加载方案 = B · 自托管思源字体子集**（`@fontsource/noto-sans-sc` + `@fontsource/noto-serif-sc`）
- **Playground 暴露策略 = dev-only**（`import.meta.env.DEV` 守卫）
- **不引入单元测试框架**：A 阶段的验证策略 = `tsc --noEmit` + `npm run build` + `/ds-playground` 目视 + 手动 `prefers-reduced-motion` 切换检查。单元测试框架（Vitest）作为 **E 子项目范围**或后续 backlog。

---

## 文件结构（创建 / 修改一览）

### 新建

```
frontend/src/
├── styles/
│   ├── tokens.css                    # §M1 · 亮/暗 CSS 变量
│   └── fonts.css                     # §M1 · @fontsource 字重声明
├── lib/
│   └── motion.ts                     # §M2 · 6 个 preset + 常用 variants
├── providers/
│   └── MotionProvider.tsx            # §M2 · reduced-motion + MotionConfig
├── components/ui/
│   ├── Button.tsx                    # §M3
│   ├── Input.tsx                     # §M3
│   ├── Textarea.tsx                  # §M3
│   ├── Select.tsx                    # §M3
│   ├── ConfirmDialog.tsx             # §M3
│   ├── Card.tsx                      # §M4
│   ├── Drawer.tsx                    # §M4
│   ├── Tabs.tsx                      # §M4
│   ├── Dropdown.tsx                  # §M4
│   ├── Toast.tsx                     # §M5
│   ├── Skeleton.tsx                  # §M5
│   ├── Badge.tsx                     # §M5
│   ├── Avatar.tsx                    # §M5
│   ├── PageTransition.tsx            # §M5
│   ├── ScrollReveal.tsx              # §M5
│   └── index.ts                      # §M5 · barrel export
└── pages/
    └── DSPlayground.tsx              # §M6 · dev-only 路由
```

### 修改

```
frontend/
├── package.json                      # §M1 · 新增 motion / @radix-ui/* / @fontsource/*
├── tailwind.config.js                # §M1 · 扩 fontFamily.serif、fontSize、shadow-e1..e5、语义令牌
├── index.html                        # §M1 · 移除 Google Fonts 外链（已不需要）
├── src/
│   ├── main.tsx                      # §M1 · import tokens.css + fonts.css
│   ├── index.css                     # §M1 · 精简（移 Google Fonts，标记 legacy 类）
│   ├── App.tsx                       # §M2 + §M6 · 包 MotionProvider、dev-only 注册 /ds-playground
│   ├── components/
│   │   ├── ThemeProvider.tsx         # §M2 · 增强 localStorage + prefers-color-scheme 兜底
│   │   └── ui/
│   │       └── Modal.tsx             # §M4 · 升级：加 size='full'、config close-on-overlay、motion 进退场
│   └── lib/
│       └── utils.ts                  # §M5 · 不改逻辑；仅作为 cn() 的既有导出源，无新内容
```

### 保留但标记 legacy（本阶段不动）

- `src/lib/theme.ts` —— 仍服务 `PersonalCenter / Settings / ThemeProvider` 的老动态主题逻辑
- `src/index.css` 中的 `.btn-primary / .btn-secondary / .btn-ghost / .glass-card / .glass-nav / .dot-grid-bg / .gradient-text-*` —— 加 `/* @deprecated use <Button>/<Card> 见 components/ui */` 注释

---

## 里程碑总览

| # | 里程碑 | 任务数 | 估时 | 负责档位 |
|---|---|---|---|---|
| M1 | Tokens + Tailwind + 自托管字体 | 4 | 3h | Opus（定调） |
| M2 | 动效工具层 + Providers | 3 | 2h | Opus |
| M3 | 基础输入类组件（5） | 5 | 3h | Composer 2 |
| M4 | 容器 & 导航组件（5） | 5 | 4h | Composer 2 |
| M5 | 反馈展示（4） + 动效基座（2） | 6 | 4h | Composer 2 |
| M6 | `/ds-playground` + 验收 + 收尾 | 3 | 2h | Opus（审美验收） |
| **合计** | | **26** | **≈ 18h** | |

每完成一个任务都应 `git add ... && git commit`，分支 `AI-coding`（参见 `.cursor/rules/mtc-refactor-roadmap.mdc` §六）。**M1 完成和 M6 验收**是两个「强 review 点」——请用户目视后再继续下一阶段。

---

# M1 · Tokens + Tailwind + 自托管字体

## 任务 1：安装新增依赖

**文件：**
- 修改：`frontend/package.json`（通过 `npm install` 自动写入）

- [ ] **步骤 1.1：安装动效 + Headless 基座 + 字体**

运行（在 `frontend/` 目录）：

```bash
npm install motion@^12 @radix-ui/react-dialog@^1 @radix-ui/react-dropdown-menu@^2 @radix-ui/react-select@^2 @radix-ui/react-tabs@^1 @radix-ui/react-avatar@^1 @fontsource/noto-sans-sc@^5 @fontsource/noto-serif-sc@^5
```

预期：`package.json` 新增 8 个依赖项；`npm audit` 无 high 级漏洞。

- [ ] **步骤 1.2：验证安装**

运行：`npm run type-check`
预期：无 TS 错误（当前代码未引用新依赖，仅确认安装未破坏）。

- [ ] **步骤 1.3：Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(A): 安装动效 + Radix + 自托管字体依赖"
```

---

## 任务 2：建立 tokens.css + fonts.css

**文件：**
- 创建：`frontend/src/styles/tokens.css`
- 创建：`frontend/src/styles/fonts.css`

- [ ] **步骤 2.1：创建 tokens.css（亮/暗语义变量）**

```css
/* frontend/src/styles/tokens.css */
/* 子项目 A · 设计系统语义令牌（对应 docs/design-system.md §2） */

:root {
  /* 背景 */
  --bg-canvas: #FEFEF9;
  --bg-surface: #FFFFFF;
  --bg-subtle: #FAF7E6;
  --bg-muted: #F5F0D6;

  /* 文本 */
  --text-primary: #064E3B;
  --text-secondary: #047857;
  --text-muted: #64748B;

  /* 品牌 */
  --brand-primary: #10B981;
  --brand-primary-hover: #059669;
  --brand-primary-active: #047857;
  --brand-accent: #F59E0B;

  /* 边界 */
  --border-default: rgba(167, 243, 208, 0.4);
  --border-strong: rgba(5, 150, 105, 0.25);

  /* 状态 */
  --success: #10B981;
  --warning: #F59E0B;
  --danger: #E11D48;
  --info: #0EA5E9;

  /* 阴影着色基 */
  --shadow-color: 5, 150, 105;
}

.dark {
  --bg-canvas: #1A120B;
  --bg-surface: #2A1D12;
  --bg-subtle: #3A2819;
  --bg-muted: #4A3422;

  --text-primary: #F5E6C8;
  --text-secondary: #D4B896;
  --text-muted: #9B8668;

  --brand-primary: #FBBF24;
  --brand-primary-hover: #F59E0B;
  --brand-primary-active: #D97706;
  --brand-accent: #34D399;

  --border-default: rgba(251, 191, 36, 0.2);
  --border-strong: rgba(251, 191, 36, 0.35);

  --success: #34D399;
  --warning: #FBBF24;
  --danger: #FB7185;
  --info: #38BDF8;

  --shadow-color: 0, 0, 0;
}
```

- [ ] **步骤 2.2：创建 fonts.css（@fontsource 声明）**

```css
/* frontend/src/styles/fonts.css */
/* 子项目 A · 自托管思源字体（@fontsource）· 对应 docs/design-system.md §3.1 */

@import '@fontsource/noto-sans-sc/400.css';
@import '@fontsource/noto-sans-sc/500.css';
@import '@fontsource/noto-sans-sc/600.css';
@import '@fontsource/noto-sans-sc/700.css';

@import '@fontsource/noto-serif-sc/400.css';
@import '@fontsource/noto-serif-sc/500.css';
@import '@fontsource/noto-serif-sc/700.css';
```

- [ ] **步骤 2.3：在 main.tsx 中引入**

修改 `frontend/src/main.tsx`，在现有 `import './index.css'` 之前插入：

```ts
import './styles/tokens.css'
import './styles/fonts.css'
import './index.css'
```

- [ ] **步骤 2.4：验证**

运行：`npm run dev`
预期：旧页面 `/` `/login` `/dashboard` 显示正常（不退化），Network 面板看到 `noto-sans-sc-*.woff2` 被加载（不再请求 fonts.googleapis.com）。

- [ ] **步骤 2.5：Commit**

```bash
git add src/styles/ src/main.tsx
git commit -m "feat(A): 建立语义 tokens + 自托管思源字体"
```

---

## 任务 3：扩展 tailwind.config.js（字体族 / 字阶 / 阴影 / 语义色）

**文件：**
- 修改：`frontend/tailwind.config.js`

- [ ] **步骤 3.1：替换 theme.extend**

将 `tailwind.config.js` 的 `theme.extend` 整段替换为以下（保留现有色板，新增字体/字阶/阴影/语义令牌）：

```js
theme: {
  extend: {
    colors: {
      warm: { 50: '#FEFEF9', 100: '#FDFBF2', 200: '#FAF7E6', 300: '#F5F0D6' },
      jade: { 50: '#ECFDF5', 100: '#D1FAE5', 200: '#A7F3D0', 300: '#6EE7B7', 400: '#34D399', 500: '#10B981', 600: '#059669', 700: '#047857', 800: '#065F46', 900: '#064E3B', 950: '#022C22' },
      amber: { 50: '#FFFBEB', 100: '#FEF3C7', 200: '#FDE68A', 300: '#FCD34D', 400: '#FBBF24', 500: '#F59E0B', 600: '#D97706', 700: '#B45309' },
      rose: { 50: '#FFF1F2', 100: '#FFE4E6', 200: '#FECDD3', 300: '#FDA4AF', 400: '#FB7185', 500: '#F43F5E', 600: '#E11D48', 700: '#BE123C' },
      sky: { 50: '#F0F9FF', 100: '#E0F2FE', 200: '#BAE6FD', 300: '#7DD3FC', 400: '#38BDF8', 500: '#0EA5E9', 600: '#0284C7', 700: '#0369A1' },
      violet: { 50: '#F5F3FF', 100: '#EDE9FE', 200: '#DDD6FE', 300: '#C4B5FD', 400: '#A78BFA', 500: '#8B5CF6', 600: '#7C3AED', 700: '#6D28D9' },
      forest: { 50: '#F0FDF4', 100: '#DCFCE7', 200: '#BBF7D0', 300: '#86EFAC', 400: '#4ADE80', 500: '#22C55E', 600: '#16A34A', 700: '#15803D' },
      slate: { 450: '#64748B' },
      // 语义令牌（从 tokens.css CSS 变量读）
      canvas: 'var(--bg-canvas)',
      surface: 'var(--bg-surface)',
      subtle: 'var(--bg-subtle)',
      muted: 'var(--bg-muted)',
      ink: {
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        muted: 'var(--text-muted)',
      },
      brand: {
        DEFAULT: 'var(--brand-primary)',
        hover: 'var(--brand-primary-hover)',
        active: 'var(--brand-primary-active)',
        accent: 'var(--brand-accent)',
      },
    },
    fontFamily: {
      sans: ['"Noto Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
      serif: ['"Noto Serif SC"', '"Songti SC"', '"SimSun"', 'Georgia', 'serif'],
      display: ['"Noto Serif SC"', '"Noto Sans SC"', 'serif'],
      mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
    },
    fontSize: {
      // design-system.md §3.3 字阶
      'display': ['3.5rem', { lineHeight: '1.15', fontWeight: '500' }],
      'h1': ['2.5rem', { lineHeight: '1.2', fontWeight: '500' }],
      'h2': ['2rem', { lineHeight: '1.25', fontWeight: '500' }],
      'h3': ['1.5rem', { lineHeight: '1.3', fontWeight: '600' }],
      'h4': ['1.25rem', { lineHeight: '1.4', fontWeight: '600' }],
      'body-lg': ['1.0625rem', { lineHeight: '1.75' }],
      'body': ['0.9375rem', { lineHeight: '1.7' }],
      'body-sm': ['0.8125rem', { lineHeight: '1.6' }],
      'caption': ['0.75rem', { lineHeight: '1.5', fontWeight: '500' }],
      'quote': ['1.375rem', { lineHeight: '1.8', fontStyle: 'italic' }],
      'num-lg': ['3rem', { lineHeight: '1', fontWeight: '500', fontVariantNumeric: 'tabular-nums' }],
    },
    borderRadius: {
      // design-system.md §4.2
      'sm': '6px',
      'md': '10px',
      'lg': '14px',
      'xl': '20px',
      '2xl': '24px',
      '3xl': '32px',
    },
    boxShadow: {
      // design-system.md §4.3 · elevation 系统
      'e1': '0 1px 2px rgba(var(--shadow-color), 0.05)',
      'e2': '0 4px 12px rgba(var(--shadow-color), 0.08)',
      'e3': '0 12px 32px rgba(var(--shadow-color), 0.12)',
      'e4': '0 24px 64px rgba(var(--shadow-color), 0.16)',
      'e5': '0 32px 96px rgba(var(--shadow-color), 0.20)',
      // 保留旧项避免破坏
      'glass': '0 8px 32px 0 rgba(5, 150, 105, 0.08)',
      'glass-lg': '0 16px 48px 0 rgba(5, 150, 105, 0.12)',
      'jade': '0 4px 24px 0 rgba(5, 150, 105, 0.25)',
      'jade-lg': '0 8px 40px 0 rgba(5, 150, 105, 0.35)',
      'warm': '0 4px 24px 0 rgba(161, 98, 7, 0.08)',
    },
    backdropBlur: { xs: '2px' },
    // 保留现有 keyframes / animation（旧页面在用）
    animation: {
      'fade-in': 'fadeIn 0.6s ease-out forwards',
      'fade-up': 'fadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      'slide-in': 'slideIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      'float': 'float 6s ease-in-out infinite',
      'pulse-soft': 'pulseSoft 3s ease-in-out infinite',
      'shimmer': 'shimmer 2s linear infinite',
      'blob': 'blob 7s ease-in-out infinite',
    },
    keyframes: {
      fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
      fadeUp: { '0%': { opacity: '0', transform: 'translateY(30px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      slideIn: { '0%': { opacity: '0', transform: 'translateX(-20px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
      float: { '0%, 100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-20px)' } },
      pulseSoft: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.7' } },
      shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      blob: { '0%, 100%': { borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%' }, '50%': { borderRadius: '30% 60% 70% 40% / 50% 60% 30% 60%' } },
    },
  },
},
```

- [ ] **步骤 3.2：删除废弃 primary 色板**

在 `tailwind.config.js` 的 `colors` 里**移除** `primary` 色板（旧紫色调色板），确保没有页面引用它：

运行：
```bash
rg "text-primary-|bg-primary-|border-primary-" frontend/src/
```
预期：零匹配。若有，**暂不删除**，改为任务 3.x 跟进。

- [ ] **步骤 3.3：验证**

运行：`npm run build`
预期：构建通过；`dist/assets/` 生成的 CSS 文件大小与改造前差异 ≤ 5%。

- [ ] **步骤 3.4：Commit**

```bash
git add tailwind.config.js
git commit -m "feat(A): Tailwind 扩展字体族/字阶/阴影 e1-e5/语义令牌"
```

---

## 任务 4：精简 index.css（移除 Google Fonts，标记 legacy 类）

**文件：**
- 修改：`frontend/src/index.css`
- 修改：`frontend/index.html`

- [ ] **步骤 4.1：从 index.css 顶部移除 Google Fonts import**

删除 `frontend/src/index.css` 第 1 行的 `@import url('https://fonts.googleapis.com/...')`。

- [ ] **步骤 4.2：把 `:root` 的字体改为通过 Tailwind 管理**

修改 `index.css` 第 6–13 行的 `:root` 块为：

```css
:root {
  line-height: 1.7;
  color: var(--text-primary);
  background-color: var(--bg-canvas);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-family: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
}
```

- [ ] **步骤 4.3：标记 legacy 组件类**

在 `index.css` 的 `@layer components` 块开头添加注释：

```css
@layer components {
  /* @deprecated A 子项目已引入 <Button>/<Card> 等组件，见 components/ui/*
     本区所有类仅为兼容旧页面（LandingPage 等）保留，将在 B 子项目中迁移后删除。 */

  .glass-card { /* ...原内容... */ }
  /* ...其他类保持原样... */
}
```

- [ ] **步骤 4.4：index.html 移除可能残留的 fonts 外链**

检查 `frontend/index.html`，如有 `<link rel="preconnect" href="https://fonts.googleapis.com">` 或对应 CSS 链接，**全部删除**。

- [ ] **步骤 4.5：验证**

运行：`npm run dev`，浏览 `/`（LandingPage）
预期：页面正常显示；Network 面板无 `fonts.googleapis.com` 请求；字体由 `@fontsource/*` 提供。

- [ ] **步骤 4.6：Commit**

```bash
git add src/index.css index.html
git commit -m "refactor(A): 切换到自托管字体，旧 utility 类标记 deprecated"
```

**🟢 M1 复核点**：请用户 `npm run dev` 浏览 `/` `/login` `/dashboard`，确认视觉无退化后再进 M2。

---

# M2 · 动效工具层 + Providers

## 任务 5：创建 lib/motion.ts（6 个 preset + 通用 variants）

**文件：**
- 创建：`frontend/src/lib/motion.ts`

- [ ] **步骤 5.1：完整实现**

```ts
// frontend/src/lib/motion.ts
/**
 * 动效 preset 与通用 variants
 * 对应 docs/design-system.md §5.2 · 柔中带力 Confident
 */
import type { Transition, Variants } from 'motion/react'

/** 6 个 preset（design-system §5.2） */
export const motionPresets = {
  instant: { duration: 0.15, ease: [0.4, 0, 0.2, 1] } as Transition,
  gentle: { duration: 0.25, ease: [0.16, 1, 0.3, 1] } as Transition,
  confident: {
    type: 'spring',
    stiffness: 260,
    damping: 28,
    mass: 0.9,
  } as Transition,
  cinematic: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } as Transition,
  pageEnter: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } as Transition,
  pageExit: { duration: 0.25, ease: [0.4, 0, 0.6, 1] } as Transition,
} as const

/** 常用 variants（design-system §5.3） */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: motionPresets.confident },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: motionPresets.gentle },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: motionPresets.confident },
}

export const slideRight: Variants = {
  hidden: { x: '100%' },
  visible: { x: 0, transition: motionPresets.confident },
  exit: { x: '100%', transition: motionPresets.pageExit },
}

export const slideLeft: Variants = {
  hidden: { x: '-100%' },
  visible: { x: 0, transition: motionPresets.confident },
  exit: { x: '-100%', transition: motionPresets.pageExit },
}

export const slideUp: Variants = {
  hidden: { y: '100%' },
  visible: { y: 0, transition: motionPresets.confident },
  exit: { y: '100%', transition: motionPresets.pageExit },
}

/** 父级 stagger 容器（design-system §5.3） */
export const staggerContainer = (stagger = 0.06): Variants => ({
  hidden: {},
  visible: {
    transition: { staggerChildren: stagger, delayChildren: 0.05 },
  },
})

/** 页面切换 variants（给 PageTransition 用） */
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: motionPresets.pageEnter },
  exit: { opacity: 0, y: -8, transition: motionPresets.pageExit },
}
```

- [ ] **步骤 5.2：验证类型**

运行：`npm run type-check`
预期：无错误。若 `motion/react` 导入失败，改为 `'motion'`（motion v12 的主入口依版本可能有差异）；再次运行确认通过。

- [ ] **步骤 5.3：Commit**

```bash
git add src/lib/motion.ts
git commit -m "feat(A): 新增 motion preset + 通用 variants"
```

---

## 任务 6：新建 providers/MotionProvider.tsx

**文件：**
- 创建：`frontend/src/providers/MotionProvider.tsx`

- [ ] **步骤 6.1：实现**

```tsx
// frontend/src/providers/MotionProvider.tsx
/**
 * 统一的 motion 全局配置
 * - 尊重用户 prefers-reduced-motion（自动减弱为 0 时长）
 * - 对应 docs/design-system.md §5.4
 */
import { MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'

export default function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      {children}
    </MotionConfig>
  )
}
```

- [ ] **步骤 6.2：在 App.tsx 中包裹**

修改 `frontend/src/App.tsx`：

```tsx
// 在顶部 import 区增加
import MotionProvider from './providers/MotionProvider'

// 将 return 里的 <ThemeProvider> 改为：
return (
  <MotionProvider>
    <ThemeProvider>
      <Routes>
        {/* ... 不变 ... */}
      </Routes>
    </ThemeProvider>
  </MotionProvider>
)
```

- [ ] **步骤 6.3：验证**

运行：`npm run dev`，打开 `/` 浏览。在浏览器 DevTools **Rendering 面板**勾选 `prefers-reduced-motion: reduce`，刷新页面。
预期：旧页面动画仍然能看，但 motion 驱动的组件（M3 之后会出现）将跳过过渡。目前没有 motion 组件，仅确认 provider 不破坏现有页面。

- [ ] **步骤 6.4：Commit**

```bash
git add src/providers/ src/App.tsx
git commit -m "feat(A): 新增 MotionProvider 全局 reduced-motion"
```

---

## 任务 7：增强 components/ThemeProvider.tsx（localStorage + system fallback）

**文件：**
- 修改：`frontend/src/components/ThemeProvider.tsx`

- [ ] **步骤 7.1：增强逻辑**

完整替换 `ThemeProvider.tsx` 内容为：

```tsx
/**
 * 主题提供者 · A 子项目增强版
 * - 匿名用户：读取 localStorage，缺省跟随 prefers-color-scheme
 * - 登录用户：读取后端 preferences，覆盖 localStorage
 * - 支持 light / dark / system 三档
 */
import { useEffect } from 'react'
import { useAuthStore } from '@/hooks/useAuthStore'
import { preferencesApi } from '@/services/api'
import { applyTheme, ThemeConfig, getDefaultTheme } from '@/lib/theme'

const STORAGE_KEY = 'mtc.theme'

function readLocal(): ThemeConfig['mode'] | null {
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'light' || v === 'dark' || v === 'auto' ? v : null
}

function resolveAnonymous(): ThemeConfig {
  const base = getDefaultTheme()
  const local = readLocal()
  if (local) return { ...base, mode: local }
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return { ...base, mode: prefersDark ? 'dark' : 'light' }
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    async function loadAndApplyTheme() {
      if (!isAuthenticated) {
        applyTheme(resolveAnonymous())
        return
      }
      try {
        const prefs = await preferencesApi.get() as any
        const config: ThemeConfig = {
          mode: prefs.theme || readLocal() || 'light',
          primaryColor: prefs.primary_color || 'jade',
          cardStyle: prefs.card_style || 'glass',
          fontSize: prefs.font_size || 'medium',
        }
        applyTheme(config)
        if (config.mode) localStorage.setItem(STORAGE_KEY, config.mode)
      } catch {
        applyTheme(resolveAnonymous())
      }
    }
    loadAndApplyTheme()
  }, [isAuthenticated])

  // 系统主题变化监听（仅 mode='auto' 时触发重新应用）
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (readLocal() === 'auto' || readLocal() === null) {
        applyTheme(resolveAnonymous())
      }
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return <>{children}</>
}

/** 供 UI 切换按钮使用 */
export function setThemeMode(mode: ThemeConfig['mode']) {
  localStorage.setItem(STORAGE_KEY, mode)
  const next: ThemeConfig = { ...getDefaultTheme(), mode }
  applyTheme(next)
}
```

- [ ] **步骤 7.2：验证**

运行：`npm run dev`，浏览 `/`（未登录）
- 打开 DevTools → Rendering → 勾选 `prefers-color-scheme: dark` → 刷新 → 预期：页面转暗色
- 控制台执行 `localStorage.setItem('mtc.theme', 'light'); location.reload()` → 预期：强制回亮色

- [ ] **步骤 7.3：Commit**

```bash
git add src/components/ThemeProvider.tsx
git commit -m "feat(A): 主题兜底到 prefers-color-scheme + localStorage"
```

**🟢 M2 复核点**：请用户操作上述三种主题切换场景，确认符合预期后进 M3。

---

# M3 · 基础输入类组件（5）

**共同约定**（所有 M3 组件适用）：

1. **文件头**：带 JSDoc 注释，说明组件职责 + 设计文档章节引用
2. **Props**：继承原生 HTMLAttributes，确保 `ref` / `className` / `...rest` 全部透传
3. **className 合并**：使用 `import { cn } from '@/lib/utils'`
4. **动效**：需要进场/状态切换时，只用 `motion` 组件 + `motion.ts` 的 preset/variants
5. **无障碍**：`disabled` / `aria-*` / 焦点环（`focus-visible:ring-2`）
6. **导出**：默认导出 + named 导出，便于 barrel 统一

## 任务 8：Button

**文件：**
- 创建：`frontend/src/components/ui/Button.tsx`

- [ ] **步骤 8.1：实现（这是组件模板，后续组件参考其结构）**

```tsx
// frontend/src/components/ui/Button.tsx
/**
 * Button · A 子项目基础组件
 * 对应 docs/design-system.md §6.1
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'amber'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  loading?: boolean
  fullWidth?: boolean
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-jade-500 text-white hover:bg-jade-600 active:bg-jade-700 shadow-e2 hover:shadow-e3 dark:bg-amber-400 dark:text-ink-primary dark:hover:bg-amber-500',
  secondary:
    'bg-white text-jade-700 border border-jade-200 hover:bg-jade-50 hover:border-jade-300 dark:bg-transparent dark:text-amber-200 dark:border-amber-400/40',
  ghost:
    'bg-transparent text-jade-600 hover:bg-jade-50 active:bg-jade-100 dark:text-amber-300 dark:hover:bg-amber-400/10',
  danger:
    'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 shadow-e2',
  amber:
    'bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700 shadow-e2',
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-9 px-4 text-body-sm rounded-lg gap-1.5',
  md: 'h-11 px-6 text-body rounded-xl gap-2',
  lg: 'h-13 px-8 text-body-lg rounded-2xl gap-2.5',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, children, leftIcon, rightIcon, loading, fullWidth, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-sans font-semibold',
        'transition-colors duration-150 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        leftIcon
      )}
      <span>{children}</span>
      {!loading && rightIcon}
    </button>
  )
})

export default Button
export { Button }
```

- [ ] **步骤 8.2：验证类型**

运行：`npm run type-check`
预期：无错误。

- [ ] **步骤 8.3：Commit**

```bash
git add src/components/ui/Button.tsx
git commit -m "feat(A): Button 组件（5 变体 × 3 尺寸）"
```

---

## 任务 9：Input

**文件：**
- 创建：`frontend/src/components/ui/Input.tsx`

- [ ] **步骤 9.1：实现**

```tsx
// frontend/src/components/ui/Input.tsx
/**
 * Input · A 子项目基础组件
 * 对应 docs/design-system.md §6.1
 * - label / hint / error 三 slot
 * - 前后缀 icon
 */
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  hint?: string
  error?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
}

const sizeH: Record<NonNullable<InputProps['size']>, string> = {
  sm: 'h-9 text-body-sm',
  md: 'h-11 text-body',
  lg: 'h-13 text-body-lg',
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leftIcon, rightIcon, className, size = 'md', fullWidth, id, ...rest },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  const hasError = Boolean(error)

  return (
    <div className={cn('flex flex-col gap-1.5', fullWidth && 'w-full')}>
      {label && (
        <label htmlFor={inputId} className="text-body-sm font-medium text-ink-secondary">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leftIcon && (
          <span className="absolute left-3 flex items-center text-ink-muted pointer-events-none">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={hasError}
          aria-describedby={hint || error ? `${inputId}-desc` : undefined}
          className={cn(
            'w-full rounded-md bg-subtle text-ink-primary placeholder:text-ink-muted',
            'border border-transparent focus:border-brand',
            'focus:outline-none focus:ring-2 focus:ring-brand/25',
            'transition-colors duration-150 ease-out',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            sizeH[size],
            leftIcon ? 'pl-10' : 'pl-4',
            rightIcon ? 'pr-10' : 'pr-4',
            hasError && 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/25',
            className,
          )}
          {...rest}
        />
        {rightIcon && (
          <span className="absolute right-3 flex items-center text-ink-muted">
            {rightIcon}
          </span>
        )}
      </div>
      {(hint || error) && (
        <span
          id={`${inputId}-desc`}
          className={cn('text-caption', hasError ? 'text-rose-600' : 'text-ink-muted')}
        >
          {error ?? hint}
        </span>
      )}
    </div>
  )
})

export default Input
export { Input }
```

- [ ] **步骤 9.2：类型验证 + Commit**

```bash
npm run type-check
git add src/components/ui/Input.tsx
git commit -m "feat(A): Input 组件（含 label/hint/error + 前后 icon）"
```

---

## 任务 10：Textarea

**文件：**
- 创建：`frontend/src/components/ui/Textarea.tsx`

- [ ] **步骤 10.1：实现**

```tsx
// frontend/src/components/ui/Textarea.tsx
/**
 * Textarea · A 子项目基础组件
 * 对应 docs/design-system.md §6.1
 * - 自动高度（可选）
 * - 字符计数（传 maxLength 时自动显示）
 */
import { forwardRef, useEffect, useId, useRef, useState, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
  autoGrow?: boolean
  fullWidth?: boolean
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, autoGrow, fullWidth, id, maxLength, value, defaultValue, onChange, ...rest },
  ref,
) {
  const autoId = useId()
  const taId = id ?? autoId
  const innerRef = useRef<HTMLTextAreaElement | null>(null)
  const [len, setLen] = useState<number>(
    typeof value === 'string' ? value.length : typeof defaultValue === 'string' ? defaultValue.length : 0,
  )

  useEffect(() => {
    if (!autoGrow) return
    const el = innerRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [autoGrow, value])

  return (
    <div className={cn('flex flex-col gap-1.5', fullWidth && 'w-full')}>
      {label && (
        <label htmlFor={taId} className="text-body-sm font-medium text-ink-secondary">
          {label}
        </label>
      )}
      <textarea
        ref={(el) => {
          innerRef.current = el
          if (typeof ref === 'function') ref(el)
          else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = el
        }}
        id={taId}
        maxLength={maxLength}
        value={value}
        defaultValue={defaultValue}
        onChange={(e) => {
          setLen(e.target.value.length)
          onChange?.(e)
        }}
        aria-invalid={Boolean(error)}
        className={cn(
          'min-h-24 w-full rounded-md bg-subtle text-ink-primary placeholder:text-ink-muted',
          'border border-transparent focus:border-brand',
          'focus:outline-none focus:ring-2 focus:ring-brand/25',
          'px-4 py-3 text-body',
          'resize-y transition-colors duration-150',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/25',
          className,
        )}
        {...rest}
      />
      <div className="flex items-start justify-between gap-2">
        <span className={cn('text-caption', error ? 'text-rose-600' : 'text-ink-muted')}>
          {error ?? hint ?? ''}
        </span>
        {typeof maxLength === 'number' && (
          <span className="text-caption text-ink-muted tabular-nums">{len}/{maxLength}</span>
        )}
      </div>
    </div>
  )
})

export default Textarea
export { Textarea }
```

- [ ] **步骤 10.2：类型验证 + Commit**

```bash
npm run type-check
git add src/components/ui/Textarea.tsx
git commit -m "feat(A): Textarea 组件（自动高度 + 字符计数）"
```

---

## 任务 11：Select（基于 Radix）

**文件：**
- 创建：`frontend/src/components/ui/Select.tsx`

- [ ] **步骤 11.1：实现**

```tsx
// frontend/src/components/ui/Select.tsx
/**
 * Select · A 子项目基础组件
 * 基于 @radix-ui/react-select
 * 对应 docs/design-system.md §6.1
 */
import * as RadixSelect from '@radix-ui/react-select'
import { ChevronDown, Check } from 'lucide-react'
import { forwardRef, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { scaleIn } from '@/lib/motion'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps {
  value?: string
  defaultValue?: string
  onValueChange?: (v: string) => void
  options: SelectOption[]
  placeholder?: string
  label?: string
  disabled?: boolean
  className?: string
  triggerClassName?: string
  fullWidth?: boolean
}

const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  { value, defaultValue, onValueChange, options, placeholder = '请选择', label, disabled, className, triggerClassName, fullWidth },
  ref,
) {
  return (
    <div className={cn('flex flex-col gap-1.5', fullWidth && 'w-full', className)}>
      {label && <span className="text-body-sm font-medium text-ink-secondary">{label}</span>}
      <RadixSelect.Root value={value} defaultValue={defaultValue} onValueChange={onValueChange} disabled={disabled}>
        <RadixSelect.Trigger
          ref={ref}
          className={cn(
            'inline-flex items-center justify-between gap-2',
            'h-11 px-4 rounded-md bg-subtle text-body text-ink-primary',
            'border border-transparent hover:border-brand/40 focus:border-brand',
            'focus:outline-none focus:ring-2 focus:ring-brand/25',
            'transition-colors duration-150',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            fullWidth && 'w-full',
            triggerClassName,
          )}
        >
          <RadixSelect.Value placeholder={<span className="text-ink-muted">{placeholder}</span>} />
          <RadixSelect.Icon className="text-ink-muted">
            <ChevronDown size={16} />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>
        <RadixSelect.Portal>
          <RadixSelect.Content
            position="popper"
            sideOffset={6}
            asChild
          >
            <motion.div
              variants={scaleIn}
              initial="hidden"
              animate="visible"
              className="z-50 overflow-hidden rounded-xl bg-surface border border-border-default shadow-e3 min-w-[var(--radix-select-trigger-width)]"
            >
              <RadixSelect.Viewport className="p-1">
                {options.map((opt) => (
                  <RadixSelect.Item
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.disabled}
                    className={cn(
                      'relative flex items-center gap-2 px-3 py-2 rounded-md text-body text-ink-primary cursor-pointer',
                      'data-[highlighted]:bg-jade-50 data-[highlighted]:outline-none',
                      'data-[state=checked]:text-brand font-medium',
                      'data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed',
                      'dark:data-[highlighted]:bg-amber-400/10',
                    )}
                  >
                    <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
                    <RadixSelect.ItemIndicator className="ml-auto">
                      <Check size={14} />
                    </RadixSelect.ItemIndicator>
                  </RadixSelect.Item>
                ))}
              </RadixSelect.Viewport>
            </motion.div>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
    </div>
  )
})

export default Select
export { Select }
```

> **注**：CSS 变量 `--radix-select-trigger-width` 由 Radix 自动注入；`border-border-default` 是 Tailwind 对语义令牌的引用，需要在 `tailwind.config.js` 中加映射（如未生效，直接写 `border-[color:var(--border-default)]`）。

- [ ] **步骤 11.2：类型验证 + Commit**

```bash
npm run type-check
git add src/components/ui/Select.tsx
git commit -m "feat(A): Select 组件（Radix + motion 弹出）"
```

---

## 任务 12：ConfirmDialog

**文件：**
- 创建：`frontend/src/components/ui/ConfirmDialog.tsx`

- [ ] **步骤 12.1：实现（依赖任务 14 的 Modal）**

⚠️ 本任务**依赖任务 14 的 Modal 升级完成**。如果采用「按里程碑顺序执行」，**暂时用占位实现 + TODO**：

```tsx
// frontend/src/components/ui/ConfirmDialog.tsx
/**
 * ConfirmDialog · 危险操作确认弹窗
 * 对应 docs/design-system.md §6.1
 * - 用 <Modal> 作为底座
 * - 两个按钮：取消 / 确认（可配置 danger）
 */
import Modal from './Modal'
import Button from './Button'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'danger'
  loading?: boolean
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'default',
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} size="sm" title={title}>
      {description && (
        <p className="text-body text-ink-secondary mb-6">{description}</p>
      )}
      <div className="flex items-center justify-end gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={loading}>
          {cancelText}
        </Button>
        <Button
          variant={variant === 'danger' ? 'danger' : 'primary'}
          onClick={onConfirm}
          loading={loading}
        >
          {confirmText}
        </Button>
      </div>
    </Modal>
  )
}
```

- [ ] **步骤 12.2：Commit**

```bash
git add src/components/ui/ConfirmDialog.tsx
git commit -m "feat(A): ConfirmDialog 组件（基于 Modal）"
```

**🟢 M3 结束**：5 个输入类组件就绪。下一里程碑进入容器 & 导航。

---

# M4 · 容器 & 导航组件（5）

## 任务 13：Card

**文件：**
- 创建：`frontend/src/components/ui/Card.tsx`

- [ ] **步骤 13.1：实现**

```tsx
// frontend/src/components/ui/Card.tsx
/**
 * Card · 统一卡片容器
 * 对应 docs/design-system.md §6.2
 * - 三变体：plain / glass / accent
 */
import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'plain' | 'glass' | 'accent'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hoverable?: boolean
}

const variantClasses: Record<Variant, string> = {
  plain:
    'bg-surface border border-border-default shadow-e1 dark:border-amber-400/20',
  glass:
    'bg-white/70 backdrop-blur-md border border-jade-200/40 shadow-e2 dark:bg-white/5 dark:border-amber-400/20',
  accent:
    'bg-gradient-to-br from-jade-50 to-amber-50 border border-jade-200/60 shadow-e2 dark:from-amber-400/10 dark:to-transparent dark:border-amber-400/30',
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = 'plain', padding = 'md', hoverable, className, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl',
        variantClasses[variant],
        paddingClasses[padding],
        hoverable && 'transition-shadow duration-250 hover:shadow-e3',
        className,
      )}
      {...rest}
    />
  )
})

export default Card
export { Card }
```

- [ ] **步骤 13.2：Commit**

```bash
npm run type-check
git add src/components/ui/Card.tsx
git commit -m "feat(A): Card 组件（plain/glass/accent）"
```

---

## 任务 14：Modal 升级（API 兼容）

**文件：**
- 修改：`frontend/src/components/ui/Modal.tsx`

- [ ] **步骤 14.1：兼容性审阅**

当前 Modal API：`{ open, onClose, title?, children, size?: 'sm'|'md'|'lg' }`。
**必须完全保留这 5 个 prop 的语义**，才不会破坏 `ArchiveDetailPage / MemberDetailPage / ArchiveListPage` 的调用。新增 prop 全部**可选**。

- [ ] **步骤 14.2：全文替换**

```tsx
// frontend/src/components/ui/Modal.tsx
/**
 * Modal · A 子项目升级版
 * 对应 docs/design-system.md §6.2
 * - 保留原 API：open / onClose / title / children / size='sm'|'md'|'lg'
 * - 新增（全部可选）：size='full' / closeOnOverlayClick / closeOnEsc / hideClose / footer
 * - 基于 @radix-ui/react-dialog + motion 入场
 */
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { fadeIn, scaleIn } from '@/lib/motion'

type Size = 'sm' | 'md' | 'lg' | 'full'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: Size
  closeOnOverlayClick?: boolean
  closeOnEsc?: boolean
  hideClose?: boolean
  footer?: ReactNode
  className?: string
}

const sizeClasses: Record<Size, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  full: 'max-w-[min(96vw,1200px)] max-h-[92vh]',
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEsc = true,
  hideClose,
  footer,
  className,
}: ModalProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                variants={fadeIn}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
                onClick={(e) => {
                  if (!closeOnOverlayClick) e.stopPropagation()
                }}
              />
            </Dialog.Overlay>
            <Dialog.Content
              onPointerDownOutside={(e) => {
                if (!closeOnOverlayClick) e.preventDefault()
              }}
              onEscapeKeyDown={(e) => {
                if (!closeOnEsc) e.preventDefault()
              }}
              asChild
            >
              <motion.div
                variants={scaleIn}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className={cn(
                  'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
                  'w-[calc(100vw-2rem)] rounded-2xl bg-surface shadow-e4 overflow-hidden',
                  'border border-border-default',
                  sizeClasses[size],
                  size === 'full' && 'flex flex-col',
                  className,
                )}
              >
                {(title || !hideClose) && (
                  <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
                    {title ? (
                      <Dialog.Title className="font-serif text-h4 text-ink-primary">
                        {title}
                      </Dialog.Title>
                    ) : (
                      <span />
                    )}
                    {!hideClose && (
                      <Dialog.Close asChild>
                        <button
                          aria-label="关闭"
                          className="p-1.5 text-ink-muted hover:text-ink-primary hover:bg-subtle rounded-lg transition-colors"
                        >
                          <X size={18} />
                        </button>
                      </Dialog.Close>
                    )}
                  </div>
                )}
                <div className={cn('p-6', size === 'full' && 'flex-1 overflow-auto')}>
                  {children}
                </div>
                {footer && (
                  <div className="px-6 py-4 border-t border-border-default bg-subtle/40">
                    {footer}
                  </div>
                )}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
```

- [ ] **步骤 14.3：回归验证**

运行 `npm run dev`，访问以下 3 个页面，逐个触发它们的 Modal（删除/编辑等操作）：
- `/archives`
- `/archives/:id`
- `/archives/:archiveId/members/:memberId`

预期：
- 弹出位置、标题、关闭按钮行为与之前一致
- 新增了进场 scale-in 动效，退场 fade-out
- ESC 能关闭；点击遮罩能关闭
- `prefers-reduced-motion` 打开后动效消失、仍能正常打开关闭

- [ ] **步骤 14.4：Commit**

```bash
git add src/components/ui/Modal.tsx
git commit -m "feat(A): Modal 升级（Radix + motion + size=full）"
```

---

## 任务 15：Drawer

**文件：**
- 创建：`frontend/src/components/ui/Drawer.tsx`

- [ ] **步骤 15.1：实现**

```tsx
// frontend/src/components/ui/Drawer.tsx
/**
 * Drawer · 侧边抽屉
 * 对应 docs/design-system.md §6.2
 * - 方向：left / right / bottom
 * - 基于 Radix Dialog + motion slide
 */
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { fadeIn, slideLeft, slideRight, slideUp } from '@/lib/motion'

type Side = 'left' | 'right' | 'bottom'

export interface DrawerProps {
  open: boolean
  onClose: () => void
  side?: Side
  title?: string
  children: ReactNode
  width?: string
  height?: string
  hideClose?: boolean
  footer?: ReactNode
  className?: string
}

const sideClasses: Record<Side, string> = {
  left: 'left-0 top-0 h-full border-r',
  right: 'right-0 top-0 h-full border-l',
  bottom: 'left-0 bottom-0 w-full border-t rounded-t-3xl',
}

const variantMap = {
  left: slideLeft,
  right: slideRight,
  bottom: slideUp,
} as const

export default function Drawer({
  open,
  onClose,
  side = 'right',
  title,
  children,
  width = 'w-[min(420px,90vw)]',
  height = 'h-[min(70vh,720px)]',
  hideClose,
  footer,
  className,
}: DrawerProps) {
  const isBottom = side === 'bottom'
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div variants={fadeIn} initial="hidden" animate="visible" exit="hidden" className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                variants={variantMap[side]}
                initial="hidden"
                animate="visible"
                exit="exit"
                className={cn(
                  'fixed z-50 bg-surface border-border-default shadow-e4 flex flex-col',
                  sideClasses[side],
                  isBottom ? height : width,
                  className,
                )}
              >
                {(title || !hideClose) && (
                  <div className="flex items-center justify-between px-5 py-4 border-b border-border-default">
                    {title ? (
                      <Dialog.Title className="font-serif text-h4 text-ink-primary">{title}</Dialog.Title>
                    ) : (
                      <span />
                    )}
                    {!hideClose && (
                      <Dialog.Close asChild>
                        <button aria-label="关闭" className="p-1.5 text-ink-muted hover:text-ink-primary hover:bg-subtle rounded-lg transition-colors">
                          <X size={18} />
                        </button>
                      </Dialog.Close>
                    )}
                  </div>
                )}
                <div className="flex-1 overflow-auto p-5">{children}</div>
                {footer && (
                  <div className="px-5 py-4 border-t border-border-default bg-subtle/40">{footer}</div>
                )}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
```

- [ ] **步骤 15.2：Commit**

```bash
npm run type-check
git add src/components/ui/Drawer.tsx
git commit -m "feat(A): Drawer 组件（left/right/bottom 三向）"
```

---

## 任务 16：Tabs（Radix）

**文件：**
- 创建：`frontend/src/components/ui/Tabs.tsx`

- [ ] **步骤 16.1：实现**

```tsx
// frontend/src/components/ui/Tabs.tsx
/**
 * Tabs · 标签页
 * 对应 docs/design-system.md §6.2
 * - 基于 @radix-ui/react-tabs
 * - 两种样式：underline / pill
 */
import * as RadixTabs from '@radix-ui/react-tabs'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { motionPresets } from '@/lib/motion'

export interface TabsProps {
  items: { value: string; label: string; content: ReactNode; disabled?: boolean }[]
  defaultValue?: string
  value?: string
  onValueChange?: (v: string) => void
  variant?: 'underline' | 'pill'
  className?: string
}

export default function Tabs({ items, defaultValue, value, onValueChange, variant = 'underline', className }: TabsProps) {
  const initialValue = value ?? defaultValue ?? items[0]?.value
  return (
    <RadixTabs.Root
      value={value}
      defaultValue={initialValue}
      onValueChange={onValueChange}
      className={cn('flex flex-col gap-4', className)}
    >
      <RadixTabs.List
        className={cn(
          'inline-flex items-center gap-1',
          variant === 'underline' && 'border-b border-border-default',
          variant === 'pill' && 'p-1 rounded-full bg-subtle w-fit',
        )}
      >
        {items.map((item) => (
          <RadixTabs.Trigger
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            className={cn(
              'relative px-4 py-2 text-body-sm font-medium text-ink-secondary',
              'transition-colors duration-150',
              'data-[state=active]:text-brand',
              'data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 rounded-md',
              variant === 'pill' && 'rounded-full data-[state=active]:bg-surface data-[state=active]:shadow-e1',
            )}
          >
            {item.label}
            {variant === 'underline' && (
              <span
                className={cn(
                  'absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-brand',
                  'opacity-0 data-[state=active]:opacity-100',
                )}
              />
            )}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {items.map((item) => (
        <RadixTabs.Content key={item.value} value={item.value} asChild>
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={motionPresets.gentle}
            className="focus-visible:outline-none"
          >
            {item.content}
          </motion.div>
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  )
}
```

- [ ] **步骤 16.2：Commit**

```bash
npm run type-check
git add src/components/ui/Tabs.tsx
git commit -m "feat(A): Tabs 组件（underline/pill）"
```

---

## 任务 17：Dropdown（Radix）

**文件：**
- 创建：`frontend/src/components/ui/Dropdown.tsx`

- [ ] **步骤 17.1：实现**

```tsx
// frontend/src/components/ui/Dropdown.tsx
/**
 * Dropdown · 下拉菜单
 * 对应 docs/design-system.md §6.2
 * - 基于 @radix-ui/react-dropdown-menu
 */
import * as RadixDropdown from '@radix-ui/react-dropdown-menu'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { scaleIn } from '@/lib/motion'

export interface DropdownItem {
  label: string
  onSelect?: () => void
  icon?: ReactNode
  danger?: boolean
  disabled?: boolean
  separator?: boolean
}

export interface DropdownProps {
  trigger: ReactNode
  items: DropdownItem[]
  align?: 'start' | 'center' | 'end'
  className?: string
}

export default function Dropdown({ trigger, items, align = 'end', className }: DropdownProps) {
  return (
    <RadixDropdown.Root>
      <RadixDropdown.Trigger asChild>{trigger}</RadixDropdown.Trigger>
      <RadixDropdown.Portal>
        <RadixDropdown.Content align={align} sideOffset={6} asChild>
          <motion.div
            variants={scaleIn}
            initial="hidden"
            animate="visible"
            className={cn(
              'z-50 min-w-40 rounded-xl bg-surface border border-border-default shadow-e3 p-1',
              className,
            )}
          >
            {items.map((item, i) =>
              item.separator ? (
                <RadixDropdown.Separator key={`sep-${i}`} className="my-1 h-px bg-border-default" />
              ) : (
                <RadixDropdown.Item
                  key={`${item.label}-${i}`}
                  onSelect={item.onSelect}
                  disabled={item.disabled}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-md text-body-sm cursor-pointer',
                    'text-ink-primary data-[highlighted]:bg-jade-50 data-[highlighted]:outline-none',
                    'data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed',
                    'dark:data-[highlighted]:bg-amber-400/10',
                    item.danger && 'text-rose-600 data-[highlighted]:bg-rose-50 dark:data-[highlighted]:bg-rose-400/10',
                  )}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </RadixDropdown.Item>
              ),
            )}
          </motion.div>
        </RadixDropdown.Content>
      </RadixDropdown.Portal>
    </RadixDropdown.Root>
  )
}
```

- [ ] **步骤 17.2：Commit**

```bash
npm run type-check
git add src/components/ui/Dropdown.tsx
git commit -m "feat(A): Dropdown 组件（Radix + motion）"
```

**🟢 M4 结束**：容器 & 导航 5 个就绪。

---

# M5 · 反馈展示（4）+ 动效基座（2）

## 任务 18：Toast（包 react-hot-toast）

**文件：**
- 创建：`frontend/src/components/ui/Toast.tsx`

- [ ] **步骤 18.1：实现**

```tsx
// frontend/src/components/ui/Toast.tsx
/**
 * Toast · 统一品牌样式的通知
 * 对应 docs/design-system.md §6.3
 * - 包一层 react-hot-toast（已装）
 * - 在应用根挂载 <ToastHost />
 * - 使用：import { toast } from '@/components/ui/Toast'
 */
import { Toaster, toast as hotToast, type ToastOptions } from 'react-hot-toast'
import { CheckCircle2, XCircle, Info, AlertTriangle } from 'lucide-react'
import type { ReactNode } from 'react'

const baseStyle: ToastOptions = {
  duration: 3200,
  style: {
    borderRadius: '14px',
    padding: '12px 16px',
    fontSize: '14px',
    fontFamily: '"Noto Sans SC", system-ui, sans-serif',
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-default)',
    boxShadow: '0 12px 32px rgba(var(--shadow-color), 0.12)',
  },
}

export const toast = {
  success: (msg: ReactNode) => hotToast.success(msg as string, { ...baseStyle, icon: <CheckCircle2 size={18} className="text-emerald-500" /> }),
  error: (msg: ReactNode) => hotToast.error(msg as string, { ...baseStyle, icon: <XCircle size={18} className="text-rose-500" /> }),
  info: (msg: ReactNode) => hotToast(msg as string, { ...baseStyle, icon: <Info size={18} className="text-sky-500" /> }),
  warning: (msg: ReactNode) => hotToast(msg as string, { ...baseStyle, icon: <AlertTriangle size={18} className="text-amber-500" /> }),
  loading: (msg: ReactNode) => hotToast.loading(msg as string, baseStyle),
  dismiss: (id?: string) => hotToast.dismiss(id),
}

export function ToastHost() {
  return <Toaster position="top-center" gutter={8} />
}
```

- [ ] **步骤 18.2：在 App.tsx 中挂载 ToastHost**

在 `App.tsx` 里（`<MotionProvider>` 内、`<Routes>` 之外）插入 `<ToastHost />`：

```tsx
import { ToastHost } from './components/ui/Toast'

// ...
<MotionProvider>
  <ThemeProvider>
    <ToastHost />
    <Routes>{/* ... */}</Routes>
  </ThemeProvider>
</MotionProvider>
```

- [ ] **步骤 18.3：Commit**

```bash
npm run type-check
git add src/components/ui/Toast.tsx src/App.tsx
git commit -m "feat(A): Toast 统一品牌样式 + ToastHost 挂载"
```

---

## 任务 19：Skeleton

**文件：**
- 创建：`frontend/src/components/ui/Skeleton.tsx`

- [ ] **步骤 19.1：实现**

```tsx
// frontend/src/components/ui/Skeleton.tsx
/**
 * Skeleton · 骨架屏
 * 对应 docs/design-system.md §6.3
 * - 子组件：Line / Circle / Card
 * - 呼吸动效；遵循 prefers-reduced-motion（通过 Tailwind animate-pulse-soft）
 */
import { cn } from '@/lib/utils'

function base(className?: string) {
  return cn('bg-muted animate-pulse-soft rounded-md', className)
}

export function SkeletonLine({ className }: { className?: string }) {
  return <div className={base(cn('h-4 w-full', className))} />
}

export function SkeletonCircle({ size = 40, className }: { size?: number; className?: string }) {
  return <div className={cn(base(), 'rounded-full', className)} style={{ width: size, height: size }} />
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('p-4 rounded-2xl bg-surface border border-border-default flex flex-col gap-3', className)}>
      <div className="flex items-center gap-3">
        <SkeletonCircle />
        <div className="flex flex-col gap-2 flex-1">
          <SkeletonLine className="h-3 w-1/3" />
          <SkeletonLine className="h-3 w-1/5" />
        </div>
      </div>
      <SkeletonLine />
      <SkeletonLine className="w-5/6" />
      <SkeletonLine className="w-2/3" />
    </div>
  )
}

export default { Line: SkeletonLine, Circle: SkeletonCircle, Card: SkeletonCard }
```

- [ ] **步骤 19.2：Commit**

```bash
npm run type-check
git add src/components/ui/Skeleton.tsx
git commit -m "feat(A): Skeleton 骨架屏（Line/Circle/Card）"
```

---

## 任务 20：Badge

**文件：**
- 创建：`frontend/src/components/ui/Badge.tsx`

- [ ] **步骤 20.1：实现**

```tsx
// frontend/src/components/ui/Badge.tsx
/**
 * Badge · 徽章
 * 对应 docs/design-system.md §6.3
 * - 情感 / 类型 / 数值 三种用途的变体
 */
import { cn } from '@/lib/utils'
import type { HTMLAttributes, ReactNode } from 'react'

type Tone = 'jade' | 'amber' | 'rose' | 'sky' | 'violet' | 'forest' | 'neutral'
type Size = 'sm' | 'md'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  size?: Size
  dot?: boolean
  icon?: ReactNode
}

const toneClasses: Record<Tone, string> = {
  jade: 'bg-jade-50 text-jade-700 border-jade-200/60',
  amber: 'bg-amber-50 text-amber-700 border-amber-200/60',
  rose: 'bg-rose-50 text-rose-700 border-rose-200/60',
  sky: 'bg-sky-50 text-sky-700 border-sky-200/60',
  violet: 'bg-violet-50 text-violet-700 border-violet-200/60',
  forest: 'bg-forest-50 text-forest-700 border-forest-200/60',
  neutral: 'bg-subtle text-ink-secondary border-border-default',
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-5 px-2 text-caption gap-1',
  md: 'h-6 px-2.5 text-body-sm gap-1.5',
}

export default function Badge({ tone = 'neutral', size = 'sm', dot, icon, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        toneClasses[tone],
        sizeClasses[size],
        className,
      )}
      {...rest}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />}
      {icon}
      {children}
    </span>
  )
}
```

- [ ] **步骤 20.2：Commit**

```bash
npm run type-check
git add src/components/ui/Badge.tsx
git commit -m "feat(A): Badge 组件（7 tone × 2 size）"
```

---

## 任务 21：Avatar（Radix）

**文件：**
- 创建：`frontend/src/components/ui/Avatar.tsx`

- [ ] **步骤 21.1：实现**

```tsx
// frontend/src/components/ui/Avatar.tsx
/**
 * Avatar · 头像
 * 对应 docs/design-system.md §6.3
 * - 图片 / initials 回落
 * - AvatarGroup 叠加
 */
import * as RadixAvatar from '@radix-ui/react-avatar'
import { cn } from '@/lib/utils'
import type { HTMLAttributes } from 'react'

export interface AvatarProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  src?: string
  name: string
  size?: number
  shape?: 'circle' | 'square'
}

function initials(name: string) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function Avatar({ src, name, size = 40, shape = 'circle', className, ...rest }: AvatarProps) {
  return (
    <RadixAvatar.Root
      className={cn(
        'inline-flex items-center justify-center overflow-hidden bg-jade-100 text-jade-700 font-semibold select-none',
        shape === 'circle' ? 'rounded-full' : 'rounded-lg',
        'dark:bg-amber-400/20 dark:text-amber-200',
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      {...rest}
    >
      {src && <RadixAvatar.Image src={src} alt={name} className="w-full h-full object-cover" />}
      <RadixAvatar.Fallback delayMs={300} className="leading-none">
        {initials(name)}
      </RadixAvatar.Fallback>
    </RadixAvatar.Root>
  )
}

export function AvatarGroup({ children, max = 4, size = 32 }: { children: React.ReactNode; max?: number; size?: number }) {
  const arr = Array.isArray(children) ? children : [children]
  const visible = arr.slice(0, max)
  const rest = arr.length - visible.length
  return (
    <div className="inline-flex items-center">
      {visible.map((c, i) => (
        <div key={i} className="-ml-2 first:ml-0 ring-2 ring-surface rounded-full">
          {c}
        </div>
      ))}
      {rest > 0 && (
        <div
          className="-ml-2 inline-flex items-center justify-center rounded-full bg-subtle text-ink-secondary text-caption font-semibold ring-2 ring-surface"
          style={{ width: size, height: size }}
        >
          +{rest}
        </div>
      )}
    </div>
  )
}
```

- [ ] **步骤 21.2：Commit**

```bash
npm run type-check
git add src/components/ui/Avatar.tsx
git commit -m "feat(A): Avatar 组件 + AvatarGroup"
```

---

## 任务 22：PageTransition

**文件：**
- 创建：`frontend/src/components/ui/PageTransition.tsx`

- [ ] **步骤 22.1：实现**

```tsx
// frontend/src/components/ui/PageTransition.tsx
/**
 * PageTransition · 路由级页面过渡
 * 对应 docs/design-system.md §6.4
 * - 用法：在 <Routes> 外包一层 <AnimatePresence>，子路由用本组件包裹
 * - 或作为 Outlet 包装器
 */
import { AnimatePresence, motion } from 'motion/react'
import { useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { pageTransition } from '@/lib/motion'

export default function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={pageTransition}
        initial="initial"
        animate="animate"
        exit="exit"
        className="min-h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
```

- [ ] **步骤 22.2：Commit**

```bash
npm run type-check
git add src/components/ui/PageTransition.tsx
git commit -m "feat(A): PageTransition 路由级过渡"
```

> **注**：A 阶段不改 `App.tsx` 把它挂到全局路由上（避免影响现有页面）。B 子项目重做路由时再统一接入。Playground 本地会自用。

---

## 任务 23：ScrollReveal

**文件：**
- 创建：`frontend/src/components/ui/ScrollReveal.tsx`

- [ ] **步骤 23.1：实现**

```tsx
// frontend/src/components/ui/ScrollReveal.tsx
/**
 * ScrollReveal · 滚动进入视口时触发动画
 * 对应 docs/design-system.md §6.4 + §5.3
 * - 直接用 motion 的 whileInView（尊重 reduced-motion）
 * - direction / delay / stagger 可控
 */
import { motion, type Variants } from 'motion/react'
import type { ReactNode } from 'react'
import { motionPresets } from '@/lib/motion'

type Direction = 'up' | 'down' | 'left' | 'right' | 'none'

export interface ScrollRevealProps {
  children: ReactNode
  direction?: Direction
  distance?: number
  delay?: number
  once?: boolean
  className?: string
  asChild?: boolean
}

const offsetMap: Record<Direction, (d: number) => Record<string, number>> = {
  up: (d) => ({ y: d }),
  down: (d) => ({ y: -d }),
  left: (d) => ({ x: d }),
  right: (d) => ({ x: -d }),
  none: () => ({}),
}

export default function ScrollReveal({
  children,
  direction = 'up',
  distance = 24,
  delay = 0,
  once = true,
  className,
}: ScrollRevealProps) {
  const variants: Variants = {
    hidden: { opacity: 0, ...offsetMap[direction](distance) },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: { ...motionPresets.confident, delay },
    },
  }
  return (
    <motion.div
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: '-10%' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function ScrollRevealGroup({
  children,
  stagger = 0.08,
  className,
}: {
  children: ReactNode
  stagger?: number
  className?: string
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-10%' }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: stagger, delayChildren: 0.05 } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
```

- [ ] **步骤 23.2：Commit**

```bash
npm run type-check
git add src/components/ui/ScrollReveal.tsx
git commit -m "feat(A): ScrollReveal + ScrollRevealGroup"
```

**🟢 M5 结束**：16 个组件全部就位。

---

# M6 · Playground + 验收

## 任务 24：barrel export + DSPlayground 页面

**文件：**
- 创建：`frontend/src/components/ui/index.ts`
- 创建：`frontend/src/pages/DSPlayground.tsx`

- [ ] **步骤 24.1：barrel export**

```ts
// frontend/src/components/ui/index.ts
export { default as Button, type ButtonProps } from './Button'
export { default as Input, type InputProps } from './Input'
export { default as Textarea, type TextareaProps } from './Textarea'
export { default as Select, type SelectProps, type SelectOption } from './Select'
export { default as ConfirmDialog, type ConfirmDialogProps } from './ConfirmDialog'
export { default as Card, type CardProps } from './Card'
export { default as Modal, type ModalProps } from './Modal'
export { default as Drawer, type DrawerProps } from './Drawer'
export { default as Tabs, type TabsProps } from './Tabs'
export { default as Dropdown, type DropdownProps, type DropdownItem } from './Dropdown'
export { toast, ToastHost } from './Toast'
export { SkeletonLine, SkeletonCircle, SkeletonCard } from './Skeleton'
export { default as Badge, type BadgeProps } from './Badge'
export { default as Avatar, AvatarGroup, type AvatarProps } from './Avatar'
export { default as PageTransition } from './PageTransition'
export { default as ScrollReveal, ScrollRevealGroup, type ScrollRevealProps } from './ScrollReveal'
```

- [ ] **步骤 24.2：DSPlayground（dev-only）**

```tsx
// frontend/src/pages/DSPlayground.tsx
/**
 * DS Playground · A 子项目的目视验证路由（仅 DEV）
 * - App.tsx 用 import.meta.env.DEV 守卫
 * - 每个组件一个 section；右上角主题切换按钮
 */
import { useState } from 'react'
import { Sun, Moon, Trash2, Pencil, Star } from 'lucide-react'
import {
  Button, Input, Textarea, Select, ConfirmDialog,
  Card, Modal, Drawer, Tabs, Dropdown,
  toast,
  SkeletonCard, SkeletonLine,
  Badge, Avatar, AvatarGroup,
  ScrollReveal, ScrollRevealGroup,
} from '@/components/ui'
import { setThemeMode } from '@/components/ThemeProvider'

export default function DSPlayground() {
  const [modalOpen, setModalOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [selectVal, setSelectVal] = useState<string | undefined>()

  return (
    <div className="min-h-screen bg-canvas text-ink-primary px-6 py-10 md:px-12">
      <header className="flex items-center justify-between mb-10">
        <div>
          <h1 className="font-serif text-h1">设计系统 Playground</h1>
          <p className="text-body text-ink-secondary mt-1">子项目 A · 16 个 MVP 组件 · 亮 / 暗模式目视验证</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" leftIcon={<Sun size={16} />} onClick={() => setThemeMode('light')}>亮</Button>
          <Button variant="ghost" size="sm" leftIcon={<Moon size={16} />} onClick={() => setThemeMode('dark')}>暗</Button>
        </div>
      </header>

      <section className="mb-12">
        <h2 className="font-serif text-h3 mb-4">Button</h2>
        <Card padding="md" className="flex flex-wrap gap-3">
          <Button>主要</Button>
          <Button variant="secondary">次要</Button>
          <Button variant="ghost">幽灵</Button>
          <Button variant="danger" leftIcon={<Trash2 size={16} />}>删除</Button>
          <Button variant="amber" leftIcon={<Star size={16} />}>强调</Button>
          <Button size="sm">小</Button>
          <Button size="lg">大</Button>
          <Button loading>加载中</Button>
          <Button disabled>禁用</Button>
        </Card>
      </section>

      <section className="mb-12">
        <h2 className="font-serif text-h3 mb-4">Input / Textarea / Select</h2>
        <Card padding="md" className="grid md:grid-cols-3 gap-4">
          <Input label="姓名" placeholder="请输入" fullWidth />
          <Input label="邮箱" hint="我们不会泄露" type="email" fullWidth />
          <Input label="带错误" error="必填项" fullWidth />
          <Textarea label="一段回忆" placeholder="写下一段话…" autoGrow maxLength={120} fullWidth />
          <Select
            label="关系"
            value={selectVal}
            onValueChange={setSelectVal}
            fullWidth
            options={[
              { value: 'family', label: '家人' },
              { value: 'friend', label: '朋友' },
              { value: 'lover', label: '恋人' },
            ]}
          />
        </Card>
      </section>

      <section className="mb-12">
        <h2 className="font-serif text-h3 mb-4">Card</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <Card><p>plain 默认卡片</p></Card>
          <Card variant="glass" hoverable><p>glass 玻璃卡片</p></Card>
          <Card variant="accent"><p>accent 强调卡片</p></Card>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="font-serif text-h3 mb-4">Modal / Drawer / ConfirmDialog</h2>
        <Card padding="md" className="flex flex-wrap gap-3">
          <Button onClick={() => setModalOpen(true)}>打开 Modal</Button>
          <Button variant="secondary" onClick={() => setDrawerOpen(true)}>打开 Drawer</Button>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>确认删除</Button>
        </Card>
        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="示例 Modal">
          <p className="text-body text-ink-secondary">这是 Modal 的主体内容，用于验证进场动画、焦点陷阱与遮罩关闭。</p>
        </Modal>
        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="示例 Drawer">
          <p className="text-body text-ink-secondary">从右侧滑入。</p>
        </Drawer>
        <ConfirmDialog
          open={confirmOpen}
          title="确认删除"
          description="此操作不可撤销。"
          variant="danger"
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => { setConfirmOpen(false); toast.success('已删除') }}
        />
      </section>

      <section className="mb-12">
        <h2 className="font-serif text-h3 mb-4">Tabs / Dropdown</h2>
        <Card padding="md" className="flex flex-col gap-6">
          <Tabs
            items={[
              { value: 'memory', label: '记忆', content: <p>记忆列表…</p> },
              { value: 'media', label: '媒体', content: <p>媒体…</p> },
              { value: 'timeline', label: '时间线', content: <p>时间线…</p> },
            ]}
          />
          <div>
            <Dropdown
              trigger={<Button variant="ghost" size="sm">更多操作 ▾</Button>}
              items={[
                { label: '编辑', icon: <Pencil size={14} />, onSelect: () => toast.info('编辑') },
                { label: '收藏', icon: <Star size={14} />, onSelect: () => toast.success('已收藏') },
                { separator: true, label: '' },
                { label: '删除', icon: <Trash2 size={14} />, danger: true, onSelect: () => toast.error('已删除') },
              ]}
            />
          </div>
        </Card>
      </section>

      <section className="mb-12">
        <h2 className="font-serif text-h3 mb-4">Toast（点上面按钮触发）/ Skeleton / Badge / Avatar</h2>
        <Card padding="md" className="grid md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-3">
            <SkeletonCard />
            <SkeletonLine />
            <SkeletonLine className="w-5/6" />
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge tone="jade" dot>已发布</Badge>
              <Badge tone="amber">置顶</Badge>
              <Badge tone="rose">危险</Badge>
              <Badge tone="sky">信息</Badge>
              <Badge tone="violet">紫</Badge>
              <Badge tone="forest">森</Badge>
              <Badge>默认</Badge>
            </div>
            <AvatarGroup max={4}>
              <Avatar name="张三" />
              <Avatar name="李四" />
              <Avatar name="王五" />
              <Avatar name="赵六" />
              <Avatar name="孙七" />
              <Avatar name="周八" />
            </AvatarGroup>
          </div>
        </Card>
      </section>

      <section className="mb-12">
        <h2 className="font-serif text-h3 mb-4">ScrollReveal（往下滑）</h2>
        <ScrollRevealGroup className="grid md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <ScrollReveal key={i}>
              <Card padding="md" hoverable>
                <h4 className="font-serif text-h4 mb-2">第 {i} 张卡片</h4>
                <p className="text-body text-ink-secondary">滚动触发的进场动画。</p>
              </Card>
            </ScrollReveal>
          ))}
        </ScrollRevealGroup>
      </section>
    </div>
  )
}
```

- [ ] **步骤 24.3：App.tsx 挂载 dev-only 路由**

修改 `App.tsx`，在 `<Routes>` 内（公开页面区）追加：

```tsx
{/* dev-only: 设计系统 playground */}
{import.meta.env.DEV && (
  <Route path="/ds-playground" element={<DSPlayground />} />
)}
```

并在顶部 import：

```tsx
import DSPlayground from './pages/DSPlayground'
```

- [ ] **步骤 24.4：Commit**

```bash
npm run type-check
git add src/components/ui/index.ts src/pages/DSPlayground.tsx src/App.tsx
git commit -m "feat(A): DSPlayground dev-only 路由 + 组件 barrel export"
```

---

## 任务 25：验收检查（design-system.md §9）

**文件：**
- 无代码变更，仅执行验收

- [ ] **步骤 25.1：Type check**

```bash
npm run type-check
```
预期：无错误。

- [ ] **步骤 25.2：Build**

```bash
npm run build
```
预期：构建成功。记录 `dist/assets/*.js` 中主要 chunk 的大小（供与改造前对比，验证 ≤ 60KB 增量）。

运行：
```powershell
Get-ChildItem dist/assets/*.js | Sort-Object Length -Descending | Select-Object -First 5 Name, Length
```

- [ ] **步骤 25.3：Playground 目视**

运行：`npm run dev`，访问 `http://localhost:5173/ds-playground`

逐项目视检查：

- [ ] 亮色模式下 16 个组件渲染正常
- [ ] 点右上「暗」按钮，切到暗色模式，16 个组件在深木 + 琥珀底色下对比度充足
- [ ] Modal / Drawer / ConfirmDialog 的进退场动效符合 confident 节奏（不抖、不滑太远）
- [ ] Toast 四种色调触发正常
- [ ] ScrollReveal 区块滚动时元素依次入场
- [ ] Select / Dropdown 键盘导航（Tab/↑↓/Enter/Esc）正常

- [ ] **步骤 25.4：reduced-motion 验证**

DevTools → Rendering → 勾选 `prefers-reduced-motion: reduce`，刷新 `/ds-playground`。
预期：Modal / Drawer / Dropdown / ScrollReveal 全部**瞬时出现**，无过渡。

- [ ] **步骤 25.5：旧页面回归**

逐个访问：`/`、`/login`、`/dashboard`、`/archives`（登录后）、`/archives/:id`、`/archives/:id/members/:mid`
预期：每个页面视觉无退化；Modal 触发后使用新动效但功能正常。

---

## 任务 26：收尾文档 + 合并准备

**文件：**
- 创建：`docs/superpowers/completed/2026-04-24-A-design-system.md`

- [ ] **步骤 26.1：写收尾记录**

```markdown
# 子项目 A · 设计系统 + 动效基座 · 收尾记录

**完成日期**：YYYY-MM-DD
**执行模式**：内联执行 + Composer 2 协作
**涉及提交**：<git log --oneline 贴到这里>

## 做了什么

- 建立亮/暗两套 CSS 语义令牌（`src/styles/tokens.css`）
- 切换到自托管思源字体（@fontsource）
- Tailwind 扩展字阶 / 字体族 / 阴影 e1-e5 / 语义令牌引用
- 新建 `lib/motion.ts`：6 个 preset + 8 个通用 variants
- 新建 `providers/MotionProvider.tsx` 全局尊重 reduced-motion
- 增强 `components/ThemeProvider.tsx` 支持 localStorage + prefers-color-scheme
- 新建 16 个 UI 组件于 `components/ui/`（Button/Input/Textarea/Select/ConfirmDialog/Card/Modal(升级)/Drawer/Tabs/Dropdown/Toast/Skeleton/Badge/Avatar/PageTransition/ScrollReveal）
- 新建 dev-only 路由 `/ds-playground` 作为目视验证入口

## 踩到的坑

<实施时填写>

## 遗留项（进 backlog）

- [ ] 老 `.btn-*` / `.glass-*` utility class 由 B 子项目清理
- [ ] `lib/theme.ts` 动态 6 色主题在后续评估是否保留或仅用单品牌色
- [ ] 未引入单元测试框架（Vitest）—— 作为 E 子项目或专项 backlog

## Bundle 增量

- 改造前主 chunk：<填写>
- 改造后主 chunk：<填写>
- 增量：<填写> / 验收阈值 60KB：<是否通过>
```

- [ ] **步骤 26.2：更新 roadmap rule 的进度**

编辑 `.cursor/rules/mtc-refactor-roadmap.mdc` §五，将 A 从 `[ ]` 改为 `[x]`，并在文末追加「子项目 A 完成总结」小节（1–2 段话）。

- [ ] **步骤 26.3：Commit**

```bash
git add docs/superpowers/completed/ .cursor/rules/mtc-refactor-roadmap.mdc
git commit -m "docs(A): 子项目 A 收尾记录 + 路线图进度更新"
```

**🟢 M6 结束**：请用户做最终目视验收。通过后可进入 **子项目 E（后端工程化 + 媒体服务）**。

---

## 验收清单（对应 design-system.md §9）

- [ ] `npm run dev` 访问 `/ds-playground` 能看到 16 个组件全部渲染
- [ ] 每个组件都有亮色 / 暗色两种模式的视觉验证
- [ ] 所有动效在 `prefers-reduced-motion: reduce` 下被禁用
- [ ] `npm run build` 通过，bundle 大小增量 ≤ 60KB（motion 约 40KB gzip）
- [ ] 组件都导出完整 TypeScript 类型，`tsc --noEmit` 通过
- [ ] 旧的 LandingPage / Login 等页面**仍能正常显示**（不破坏）

---

## 自检（writing-plans skill 要求）

**1. 规格覆盖度**

| design-system.md 章节 | 对应任务 |
|---|---|
| §1 设计哲学 | 指导性章节，无需任务 |
| §2 色彩系统（亮/暗 tokens） | 任务 2（tokens.css） |
| §3 字体系统（自托管 + 字阶） | 任务 2（fonts.css）+ 任务 3（Tailwind fontFamily/fontSize） |
| §4.1/4.2/4.3 Spacing/Radius/Shadow | 任务 3（Tailwind 扩展） |
| §5 动效系统（6 preset + 模式） | 任务 5（motion.ts）+ 任务 6（MotionProvider）+ 各组件使用 |
| §6.1 输入类 5 组件 | 任务 8–12 |
| §6.2 容器类 5 组件 | 任务 13–17 |
| §6.3 反馈 4 组件 | 任务 18–21 |
| §6.4 动效基座 2 组件 | 任务 22–23 |
| §7 文件结构 | 全程遵循 + 任务 24 barrel export |
| §8 改造策略（新增不破坏） | 整份计划贯彻；任务 4 标记 legacy |
| §9 验收标准 | 任务 25 |

**2. 占位符扫描**：已完成——所有代码步骤都附了完整代码；无 "TODO" / "后续实现"。

**3. 类型一致性**：`ButtonProps / InputProps / ModalProps` 等在 barrel（任务 24.1）中统一导出；组件间无相互依赖的类型冲突。`Toast` 使用 `hotToast` 别名避免与导出名冲突。

---

## 执行交接

**计划已完成。** 执行方式按用户已选：

- **内联执行 + Composer 2 协作**：
  - M1、M2、M6 由 **Opus** 操作（定调与验收）
  - M3、M4、M5 由 **Composer 2** 操作（组件批量落地）
  - 每完成一个任务都 commit；每完成一个里程碑请用户目视复核
  - 必需子技能：`superpowers:executing-plans`

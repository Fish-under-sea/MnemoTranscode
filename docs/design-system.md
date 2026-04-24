# 设计系统规范 · Memory Capsule

> 版本：v1.0 · 子项目 A 产出
> 状态：**待审查**
> 适用：所有 Web 前端（落地页、应用内页、登录注册、仪表盘等）
> 不适用：Windows / Android 原生客户端

---

## 1 · 设计哲学

**基调：东方温润 · 翠暖**

一款承载家庭记忆的产品，视觉语言要做到三件事：

1. **让人放下防备**——不像企业 SaaS，也不像炫技官网。配色以奶白暖底 + 翠绿为主，情感温度不冷不躁。
2. **让内容是主角**——装饰性元素克制，留白充足，所有动效服务于"把记忆呈现得更庄重"这件事，而不是吸引眼球。
3. **中文优先**——排版以中文阅读体验为第一优先级。标题用宋体做"档案感"，正文用黑体保可读性。

**3 个关键约束**

- 不使用鲜艳原色（纯红/纯蓝/紫色渐变）做主视觉
- 不使用硬投影（`drop-shadow(0 4px 0 #000)` 风格）
- 不使用快节奏微交互（< 150ms 的弹跳）

---

## 2 · 色彩系统

### 2.1 亮色模式 · Light（默认）

**语义令牌（Semantic Tokens）**

| 令牌 | 值 | 用途 |
|---|---|---|
| `--bg-canvas` | `#FEFEF9` (warm-50) | 页面底色 |
| `--bg-surface` | `#FFFFFF` | 卡片 / 浮层底色 |
| `--bg-subtle` | `#FAF7E6` (warm-200) | 次级背景 / 输入框 |
| `--bg-muted` | `#F5F0D6` (warm-300) | 禁用态 / 骨架屏 |
| `--text-primary` | `#064E3B` (jade-900) | 主文本（原 `#1a2e1a` 调整为统一色系） |
| `--text-secondary` | `#047857` (jade-700) | 次级文本 / 辅助信息 |
| `--text-muted` | `#64748B` (slate-450) | 时间戳 / 占位文字 |
| `--brand-primary` | `#10B981` (jade-500) | 主品牌色、主按钮、链接 |
| `--brand-primary-hover` | `#059669` (jade-600) | 悬停态 |
| `--brand-primary-active` | `#047857` (jade-700) | 按下态 |
| `--brand-accent` | `#F59E0B` (amber-500) | CTA 强调、徽章、计数高亮 |
| `--border-default` | `rgba(167, 243, 208, 0.4)` (jade-200/40) | 常规描边 |
| `--border-strong` | `rgba(5, 150, 105, 0.25)` (jade-600/25) | 强描边 / 焦点环 |
| `--success` | `#10B981` (jade-500) | 成功状态（复用品牌色） |
| `--warning` | `#F59E0B` (amber-500) | 警告 |
| `--danger` | `#E11D48` (rose-600) | 危险 / 删除 |
| `--info` | `#0EA5E9` (sky-500) | 信息提示 |

### 2.2 暗色模式 · Dark Amber（深木琥珀）

切换到 `.dark` 类时激活：

| 令牌 | 值 | 用途 |
|---|---|---|
| `--bg-canvas` | `#1A120B` | 深木页面底 |
| `--bg-surface` | `#2A1D12` | 卡片底色 |
| `--bg-subtle` | `#3A2819` | 次级 |
| `--bg-muted` | `#4A3422` | 禁用 |
| `--text-primary` | `#F5E6C8` | 暖象牙白 |
| `--text-secondary` | `#D4B896` | 暖米黄 |
| `--text-muted` | `#9B8668` | 焦糖灰 |
| `--brand-primary` | `#FBBF24` (amber-400) | 琥珀代替翠绿作为主色 |
| `--brand-primary-hover` | `#F59E0B` (amber-500) | |
| `--brand-accent` | `#34D399` (jade-400) | 翠绿作为暗色强调 |
| `--border-default` | `rgba(251, 191, 36, 0.2)` | 琥珀微光描边 |

**切换策略**
- 使用 `darkMode: 'class'`（Tailwind 已配好）
- 由用户在偏好设置中显式切换 + 跟随系统（`prefers-color-scheme`）
- 关键色通过 CSS 变量而非 `dark:` 前缀切换，避免双份样式膨胀

### 2.3 辅助色板（情感标签、图表、可视化）

保留 tailwind 已有的 `rose` / `sky` / `violet` / `forest` 作为可选项，仅用于：
- 记忆条目的 **情感标签色**（喜/悲/怒/温/思）
- 图表 / 年度总结可视化
- **严禁**用于主按钮、主文本、品牌相关元素

---

## 3 · 字体系统

**选择：思源黑体（正文）+ 思源宋体（标题/引文/数字）**

### 3.1 字体族

```css
--font-sans: "Noto Sans SC", "Source Han Sans SC", "PingFang SC",
             "Microsoft YaHei", -apple-system, system-ui, sans-serif;

--font-serif: "Noto Serif SC", "Source Han Serif SC", "Songti SC",
              "SimSun", Georgia, "Times New Roman", serif;

--font-mono: "JetBrains Mono", "Fira Code", ui-monospace, monospace;
```

### 3.2 字重

- `font-sans`：300 / 400 / 500 / 600 / 700
- `font-serif`：400 / 500 / 700
- 优先从 CDN（fonts.googleapis.com）加载，失败回落系统字体

### 3.3 字阶（Type Scale）

| Token | 字号 / 行高 | 用途 |
|---|---|---|
| `text-display` | 56 / 1.15 · **serif 500** | 落地页主标、空状态大图 |
| `text-h1` | 40 / 1.2 · **serif 500** | 页面标题 |
| `text-h2` | 32 / 1.25 · **serif 500** | 区块标题、章节名 |
| `text-h3` | 24 / 1.3 · **sans 600** | 卡片标题、模态框标题 |
| `text-h4` | 20 / 1.4 · **sans 600** | 小节标题 |
| `text-body-lg` | 17 / 1.75 · **sans 400** | 记忆条目正文 |
| `text-body` | 15 / 1.7 · **sans 400** | 常规正文 |
| `text-body-sm` | 13 / 1.6 · **sans 400** | 次要信息、说明 |
| `text-caption` | 12 / 1.5 · **sans 500** | 标签、时间戳 |
| `text-quote` | 22 / 1.8 · **serif italic 400** | 引用、寄语、摘抄 |
| `text-num-lg` | 48 / 1 · **serif 500 tabular** | 统计大数字 |

### 3.4 使用原则

- **正文永远用 sans**——阅读长度超过 1 行时，黑体胜过宋体
- **标题/章节名用 serif**——标题是"纪念册封面"，用宋体给它仪式感
- **引文用 serif italic**——与 serif 标题配对，但通过 italic 区分
- **数字统计用 serif tabular-nums**——大数字显得"重"，用 serif 避免数字对齐问题加 `font-variant-numeric: tabular-nums`
- **按钮文字用 sans 600**——绝不用 serif

---

## 4 · Spacing / Radius / Shadow

### 4.1 Spacing Scale（沿用 Tailwind）

常用节奏：`4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96`（对应 tailwind 的 1/2/3/4/6/8/12/16/24）

**页面级留白规则**
- 区块内：垂直 `gap-6`（24px）
- 区块间：垂直 `gap-16` / `gap-24`（64–96px）
- 移动端统一降级为桌面值的 ~60%

### 4.2 Radius

| Token | 值 | 用途 |
|---|---|---|
| `rounded-sm` | 6px | 标签、小徽章 |
| `rounded-md` | 10px | 输入框 |
| `rounded-lg` | 14px | 小卡片、图标容器 |
| `rounded-xl` | 20px | 按钮 |
| `rounded-2xl` | 24px | 主卡片、模态框 |
| `rounded-3xl` | 32px | 大面板、英雄区 |
| `rounded-full` | 9999px | 头像、胶囊按钮 |

### 4.3 Shadow

在 `warm`/`jade`/`glass` 基础上保留；新增 `elevation` 系统：

| Token | 值 | 用途 |
|---|---|---|
| `shadow-e1` | `0 1px 2px rgba(5,150,105,0.05)` | 轻量边界 |
| `shadow-e2` | `0 4px 12px rgba(5,150,105,0.08)` | 默认卡片 |
| `shadow-e3` | `0 12px 32px rgba(5,150,105,0.12)` | 悬停卡片、浮层 |
| `shadow-e4` | `0 24px 64px rgba(5,150,105,0.16)` | 模态框、抽屉 |
| `shadow-e5` | `0 32px 96px rgba(5,150,105,0.20)` | 全屏遮罩 |

**暗色模式阴影**使用 `rgba(0,0,0,0.4~0.6)`，通过 CSS 变量 `--shadow-color` 切换。

---

## 5 · 动效系统

### 5.1 库选型

- **主库**：`motion` v12（Framer Motion 的新包名，SSR 友好、bundle 更小）
- **辅助**：`@use-gesture/react`（拖拽、手势）按需引入
- **不使用**：GSAP（过重）、Lottie（按需，仅用于特定装饰）

### 5.2 节奏哲学 · 柔中带力 Confident

所有交互动画的时长 / 缓动必须落在以下 6 个 preset 之一：

```ts
// motion 变体预设
export const motionPresets = {
  // 微交互：按钮 hover、icon 切换
  instant: {
    duration: 0.15,
    ease: [0.4, 0, 0.2, 1],
  },

  // 标准过渡：卡片 hover、tab 切换
  gentle: {
    duration: 0.25,
    ease: [0.16, 1, 0.3, 1], // expo-out
  },

  // 主要动效：页面元素入场、模态框
  confident: {
    type: 'spring',
    stiffness: 260,
    damping: 28,
    mass: 0.9,
    // ≈ 350ms 视觉完成
  },

  // 章节过渡：大区块、滚动揭示
  cinematic: {
    duration: 0.6,
    ease: [0.16, 1, 0.3, 1],
  },

  // 页面切换
  pageEnter: {
    duration: 0.45,
    ease: [0.22, 1, 0.36, 1],
  },
  pageExit: {
    duration: 0.25,
    ease: [0.4, 0, 0.6, 1],
  },
};
```

### 5.3 常用动效模式

| 模式 | 用途 | 实现 |
|---|---|---|
| **Fade-Up** | 卡片入场、滚动揭示 | `opacity 0→1` + `y: 24→0`，用 `confident` |
| **Scale-In** | 模态框、浮层 | `scale 0.96→1` + `opacity 0→1`，用 `confident` |
| **Slide-Right** | 抽屉 / 侧边面板 | `x: 100%→0`，用 `confident` |
| **Page Transition** | 路由切换 | 旧页面 `fade + y:-8` 退场，新页面 `fade + y:8→0` 入场 |
| **Stagger Children** | 列表入场 | 父节点 `staggerChildren: 0.06` |
| **Shared Layout** | 卡片→详情页 | `layoutId` 做"magic move" |
| **Scroll Reveal** | 落地页长页 | `whileInView` + `once: true` + `margin: "-10%"` |

### 5.4 无障碍

所有动效必须遵守：
```ts
const shouldReduce = useReducedMotion();
const transition = shouldReduce ? { duration: 0 } : motionPresets.confident;
```

`index.css` 中的 `@media (prefers-reduced-motion)` 兜底规则保留。

### 5.5 禁止项

- ❌ 无限旋转 / 无限脉动（除了加载指示器）
- ❌ 视差滚动超过 40% 位移
- ❌ 同一屏幕 > 3 个同时动画
- ❌ 自动播放的、有突发运动的动画（惊吓用户）

---

## 6 · 组件清单 · MVP 16

**命名**：`frontend/src/components/ui/<Name>.tsx`
**类型**：Headless + Tailwind；所有组件自带 `ref`、`className` 合并、`asChild` 模式（按需）

### 6.1 基础输入类（5）

| 组件 | 文件 | 备注 |
|---|---|---|
| `Button` | `Button.tsx` | 变体：`primary` / `secondary` / `ghost` / `danger` / `amber`；尺寸：`sm` / `md` / `lg`；替代现有 `.btn-*` 类 |
| `Input` | `Input.tsx` | 含 label / hint / error slot；前后缀 icon |
| `Textarea` | `Textarea.tsx` | 自动高度可选；字符计数 |
| `Select` | `Select.tsx` | 基于 Radix Select + motion 过渡 |
| `ConfirmDialog` | `ConfirmDialog.tsx` | 危险操作确认（删除记忆、离开家庭） |

### 6.2 容器 & 导航（5）

| 组件 | 文件 | 备注 |
|---|---|---|
| `Card` | `Card.tsx` | 统一卡片容器；变体 `plain` / `glass` / `accent` |
| `Modal` | `Modal.tsx` | 升级现有；支持 size `sm/md/lg/full`、嵌套、点击外部关闭配置 |
| `Drawer` | `Drawer.tsx` | 左/右/下三方向；用于移动端 nav、侧边筛选、设置面板 |
| `Tabs` | `Tabs.tsx` | 下划线 / 胶囊两种样式；键盘可达 |
| `Dropdown` | `Dropdown.tsx` | 菜单；基于 Radix DropdownMenu |

### 6.3 反馈 & 展示（4）

| 组件 | 文件 | 备注 |
|---|---|---|
| `Toast` | `Toast.tsx` | 包一层 `react-hot-toast`，统一品牌样式 |
| `Skeleton` | `Skeleton.tsx` | `Line` / `Circle` / `Card` 三变体；带呼吸动效 |
| `Badge` | `Badge.tsx` | 情感标签、类型标签、数值徽章 |
| `Avatar` | `Avatar.tsx` | 图片 / initials 回落；支持圆形/方形；叠加组 `AvatarGroup` |

### 6.4 动效基座（2）

| 组件 | 文件 | 备注 |
|---|---|---|
| `PageTransition` | `PageTransition.tsx` | 包裹路由出口；使用 `AnimatePresence` 做页面切换 |
| `ScrollReveal` | `ScrollReveal.tsx` | 滚动揭示包装器；接受 `delay` / `direction` / `stagger` |

### 6.5 暂不做（但已规划）

留待后续子项目按需补充：`Tooltip`（C 再加）、`Progress`（D 胶囊进度）、`Switch`（E 设置页）、`CommandPalette`（D 全局快捷操作）、`Popover`、`Accordion`。

---

## 7 · 文件结构

```
frontend/src/
├── styles/
│   ├── tokens.css          # CSS 变量定义（light + dark）
│   └── globals.css         # 从 index.css 迁移、精简
├── lib/
│   ├── cn.ts               # clsx + tailwind-merge
│   ├── motion.ts           # motionPresets + 常用 variants
│   └── tokens.ts           # TypeScript 可访问的 token 对象（给 motion 用）
├── components/
│   └── ui/
│       ├── Button.tsx
│       ├── Input.tsx
│       ├── ...             # 见 §6
│       └── index.ts        # barrel export
└── providers/
    ├── ThemeProvider.tsx   # light/dark/system 切换
    └── MotionProvider.tsx  # reduced-motion 全局 hook
```

**Tailwind 配置改造**

- 保留现有色板，**新增语义令牌引用**：`background-canvas: 'var(--bg-canvas)'` 等
- 移除不再使用的 `primary` 紫色调色板
- `fontFamily.sans` 改为思源黑体优先；新增 `fontFamily.serif`
- 新增 `shadow-e1..e5`、`fontSize` 按 §3.3 补齐

---

## 8 · 改造策略（不是全量重写）

遵循"**新增不破坏**"原则：

1. 先建 `styles/tokens.css` 和 `lib/motion.ts`
2. 新建 `components/ui/*`，与现有 `Modal.tsx` 并存
3. 在一个隔离路由 `/ds-playground`（仅 dev）展示所有组件，作为目视验证
4. 后续子项目（B/C/D）**只用新组件**，旧组件逐步替换
5. 全量替换完成后删除 `.btn-primary` 等老类、删除 tailwind 的 `primary` 色板

**A 子项目不会改动任何业务页面**——所有业务页面替换留给 B/C/D 做。

---

## 9 · 验收标准

A 子项目完成后必须满足：

- [ ] `npm run dev` 访问 `/ds-playground` 能看到 16 个组件全部渲染
- [ ] 每个组件都有亮色 / 暗色两种模式截图（或实时切换正常）
- [ ] 所有动效在 `prefers-reduced-motion: reduce` 下被禁用
- [ ] `npm run build` 通过，bundle 大小增量 ≤ 60KB（motion 约 40KB gzip）
- [ ] 组件都导出完整 TypeScript 类型，`tsc --noEmit` 通过
- [ ] 旧的 LandingPage / Login 等页面**仍能正常显示**（不破坏）

---

## 10 · 待审查要点

请检查并告诉我是否需要调整：

1. **语义令牌命名**（§2.1）是否符合习惯？`--bg-canvas` / `--text-primary` 这种命名
2. **暗色琥珀色**（§2.2）作为主色 vs 保持翠绿色阶暗化——你选了琥珀路线，但要确认暗色用户会不会觉得"太暖"
3. **字体从 Google Fonts CDN 加载**（§3.1）在国内网络下可能慢，要不要：
   - 方案 A：保持 CDN（接受首次访问慢）
   - 方案 B：自托管思源字体子集（多 200KB，但稳定）
   - 方案 C：不加载远程字体，仅依赖系统字体
4. **组件 MVP 16 个**（§6）是否有遗漏或想增减的？
5. **`/ds-playground` 路由**（§8）在生产环境要不要保留？建议 dev-only，通过 `import.meta.env.DEV` 判断。

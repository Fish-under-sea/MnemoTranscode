/**
 * 设计系统 Playground · 子项目 A 目视验证入口
 * ---------------------------------------------------------------
 * 对应 docs/design-system.md §9 验收 / plan M6·任务 25。
 *
 * 仅 DEV：在 App.tsx 用 `import.meta.env.DEV` 守卫，不会进生产构建路由。
 *
 * 目视清单：
 *   1. 亮/暗/自动三种主题下 16 个组件渲染正常
 *   2. Modal / Drawer / ConfirmDialog 进退场节奏 = confident spring（略回弹，不抖）
 *   3. Toast 四色提示定位在 top-center，样式走语义 token
 *   4. Dropdown / Select 键盘导航正常
 *   5. ScrollReveal 区块向下滚动时逐块揭开
 *   6. reduced-motion 下所有过渡瞬时完成
 */
import { useState } from 'react'
import { Sun, Moon, Monitor, Trash2, Pencil, Star, Search, Mail, Lock } from 'lucide-react'
import {
  Button, Input, Textarea, Select, ConfirmDialog,
  Card, Modal, Drawer, Tabs, Dropdown,
  toast,
  SkeletonCard, SkeletonLine, SkeletonCircle,
  Badge, Avatar, AvatarGroup,
  ScrollReveal, ScrollRevealGroup,
} from '@/components/ui'
import { setThemeMode } from '@/components/ThemeProvider'

function SectionTitle({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-serif text-h3 text-ink-primary">{children}</h2>
      {subtitle && <p className="text-body-sm text-ink-muted mt-1">{subtitle}</p>}
    </div>
  )
}

export default function DSPlayground() {
  const [modalOpen, setModalOpen] = useState(false)
  const [modalFullOpen, setModalFullOpen] = useState(false)
  const [drawerSide, setDrawerSide] = useState<'left' | 'right' | 'bottom' | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [selectVal, setSelectVal] = useState<string | undefined>()
  const [tabsVal, setTabsVal] = useState('memory')

  return (
    <div className="min-h-screen bg-canvas text-ink-primary px-6 py-10 md:px-12 lg:px-20">
      {/* ============ 顶部 · 标题 + 主题三态切换 ============ */}
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12 pb-6 border-b border-border-default">
        <div>
          <h1 className="font-serif text-display text-ink-primary leading-none">设计系统 Playground</h1>
          <p className="text-body text-ink-secondary mt-3">
            子项目 A · <span className="text-ink-primary font-medium">东方温润 · 翠暖</span> · 16 个 MVP 组件 · 亮 / 暗 / 自动模式目视验证
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge tone="jade" dot>M1 基座</Badge>
            <Badge tone="jade" dot>M2 动效</Badge>
            <Badge tone="jade" dot>M3 输入</Badge>
            <Badge tone="jade" dot>M4 容器</Badge>
            <Badge tone="jade" dot>M5 反馈</Badge>
            <Badge tone="amber" dot>M6 验收</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" leftIcon={<Sun size={16} />} onClick={() => setThemeMode('light')}>亮</Button>
          <Button variant="ghost" size="sm" leftIcon={<Moon size={16} />} onClick={() => setThemeMode('dark')}>暗</Button>
          <Button variant="ghost" size="sm" leftIcon={<Monitor size={16} />} onClick={() => setThemeMode('auto')}>跟随</Button>
        </div>
      </header>

      {/* ============ Button ============ */}
      <section className="mb-14">
        <SectionTitle subtitle="5 variant × 3 size，loading / disabled / leftIcon">Button</SectionTitle>
        <Card padding="md" className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            <Button>主要</Button>
            <Button variant="secondary">次要</Button>
            <Button variant="ghost">幽灵</Button>
            <Button variant="danger" leftIcon={<Trash2 size={16} />}>删除</Button>
            <Button variant="amber" leftIcon={<Star size={16} />}>强调</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">小按钮</Button>
            <Button size="md">标准</Button>
            <Button size="lg">大按钮</Button>
            <Button loading>加载中</Button>
            <Button disabled>禁用</Button>
            <Button fullWidth variant="secondary" className="max-w-[260px]">
              全宽按钮（受限容器内）
            </Button>
          </div>
        </Card>
      </section>

      {/* ============ Input / Textarea / Select ============ */}
      <section className="mb-14">
        <SectionTitle subtitle="label / hint / error 三 slot · 前后缀 icon · Radix Select + 键盘导航">
          Input · Textarea · Select
        </SectionTitle>
        <Card padding="md" className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Input label="姓名" placeholder="请输入姓名" fullWidth />
          <Input label="邮箱" hint="我们不会泄露你的邮箱" type="email" leftIcon={<Mail size={16} />} fullWidth />
          <Input label="密码" type="password" leftIcon={<Lock size={16} />} fullWidth />
          <Input label="带错误" error="此项为必填" defaultValue="bad" fullWidth />
          <Input label="搜索（sm 尺寸）" size="sm" leftIcon={<Search size={14} />} placeholder="关键词…" fullWidth />
          <Input label="大号档（lg 尺寸）" size="lg" placeholder="落地页 hero 用" fullWidth />
          <Textarea
            label="一段回忆"
            placeholder="写下一段珍贵的故事…"
            hint="最多 120 字，自动增高"
            autoGrow
            maxLength={120}
            fullWidth
            className="md:col-span-2"
          />
          <Select
            label="与逝者关系"
            value={selectVal}
            onValueChange={setSelectVal}
            placeholder="请选择关系"
            fullWidth
            options={[
              { value: 'parent', label: '父母' },
              { value: 'spouse', label: '配偶' },
              { value: 'sibling', label: '兄弟姐妹' },
              { value: 'child', label: '子女' },
              { value: 'friend', label: '挚友' },
              { value: 'other', label: '其他' },
            ]}
          />
        </Card>
      </section>

      {/* ============ Card ============ */}
      <section className="mb-14">
        <SectionTitle subtitle="3 variant：plain 默认 · glass 玻璃 · accent 渐变">Card</SectionTitle>
        <div className="grid md:grid-cols-3 gap-4">
          <Card padding="md">
            <h4 className="font-serif text-h4 mb-2">plain 默认</h4>
            <p className="text-body text-ink-secondary">用于常规内容块，白面 + e1 阴影。</p>
          </Card>
          <Card variant="glass" hoverable padding="md">
            <h4 className="font-serif text-h4 mb-2">glass 玻璃</h4>
            <p className="text-body text-ink-secondary">半透 + 背景模糊，适合叠在装饰背景上。</p>
          </Card>
          <Card variant="accent" padding="md">
            <h4 className="font-serif text-h4 mb-2">accent 强调</h4>
            <p className="text-body text-ink-secondary">翠→琥珀渐变底，吸引视线的摘要卡。</p>
          </Card>
        </div>
      </section>

      {/* ============ Modal / Drawer / ConfirmDialog ============ */}
      <section className="mb-14">
        <SectionTitle subtitle="Radix 基元 + motion confident spring · Modal 支持 full-screen · Drawer 三向">
          Modal · Drawer · ConfirmDialog
        </SectionTitle>
        <Card padding="md" className="flex flex-wrap gap-3">
          <Button onClick={() => setModalOpen(true)}>打开 Modal</Button>
          <Button variant="secondary" onClick={() => setModalFullOpen(true)}>Modal（full 尺寸）</Button>
          <Button variant="secondary" onClick={() => setDrawerSide('right')}>Drawer 右</Button>
          <Button variant="secondary" onClick={() => setDrawerSide('left')}>Drawer 左</Button>
          <Button variant="secondary" onClick={() => setDrawerSide('bottom')}>Drawer 底</Button>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>危险确认</Button>
        </Card>

        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="示例 Modal"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setModalOpen(false)}>取消</Button>
              <Button onClick={() => { setModalOpen(false); toast.success('已保存') }}>保存</Button>
            </div>
          }
        >
          <p className="text-body text-ink-secondary">
            验证进场动画（scale 0.96 → 1 + fade 的 spring 组合）、焦点陷阱、遮罩点击关闭、Esc 关闭、
            footer 区独立背景（bg-subtle/40）。
          </p>
        </Modal>

        <Modal
          open={modalFullOpen}
          onClose={() => setModalFullOpen(false)}
          title="全屏 Modal · 适合长表单 / 媒体详情"
          size="full"
        >
          <div className="space-y-4">
            <p className="text-body text-ink-secondary">size=&quot;full&quot; 会自动撑到视口 96vw × 92vh 并启用内容区滚动。</p>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} padding="md">
                <p className="text-body">占位内容段落 {i} —— 验证 full Modal 的内部滚动条。</p>
              </Card>
            ))}
          </div>
        </Modal>

        <Drawer
          open={drawerSide !== null}
          onClose={() => setDrawerSide(null)}
          side={drawerSide ?? 'right'}
          title={`${drawerSide ?? ''} Drawer`}
          footer={
            <Button fullWidth onClick={() => { setDrawerSide(null); toast.info('Drawer 已关闭') }}>
              关闭
            </Button>
          }
        >
          <p className="text-body text-ink-secondary">
            三向 Drawer（left / right / bottom）均基于同一 Radix Dialog 基底 + 三种 slide variants。
            bottom 变体会自动顶部圆角（rounded-t-3xl）。
          </p>
        </Drawer>

        <ConfirmDialog
          open={confirmOpen}
          title="确认删除这段记忆？"
          description="删除后将无法恢复，且相关引用会被一并移除。"
          variant="danger"
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => { setConfirmOpen(false); toast.success('已删除') }}
        />
      </section>

      {/* ============ Tabs / Dropdown ============ */}
      <section className="mb-14">
        <SectionTitle subtitle="underline / pill 两种 Tabs 样式 · Dropdown 支持 icon / separator / danger">
          Tabs · Dropdown
        </SectionTitle>
        <Card padding="md" className="flex flex-col gap-8">
          <div>
            <p className="text-caption text-ink-muted mb-2">Tabs · underline（默认）</p>
            <Tabs
              value={tabsVal}
              onValueChange={setTabsVal}
              items={[
                { value: 'memory', label: '记忆', content: <p className="text-body text-ink-secondary">记忆列表 / 时间线 / 关键词云。</p> },
                { value: 'media', label: '媒体', content: <p className="text-body text-ink-secondary">照片、录音、视频与原稿归档。</p> },
                { value: 'timeline', label: '时间线', content: <p className="text-body text-ink-secondary">按年 / 事件 / 情感筛选。</p> },
                { value: 'disabled', label: '禁用项', content: null, disabled: true },
              ]}
            />
          </div>

          <div>
            <p className="text-caption text-ink-muted mb-2">Tabs · pill</p>
            <Tabs
              variant="pill"
              items={[
                { value: 'all', label: '全部', content: <p className="text-body text-ink-secondary">全部条目</p> },
                { value: 'mine', label: '我的', content: <p className="text-body text-ink-secondary">我创建的</p> },
                { value: 'star', label: '已收藏', content: <p className="text-body text-ink-secondary">标星条目</p> },
              ]}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Dropdown
              trigger={<Button variant="secondary" size="sm">更多操作 ▾</Button>}
              items={[
                { label: '编辑', icon: <Pencil size={14} />, onSelect: () => toast.info('编辑') },
                { label: '收藏', icon: <Star size={14} />, onSelect: () => toast.success('已收藏') },
                { separator: true, label: '' },
                { label: '删除', icon: <Trash2 size={14} />, danger: true, onSelect: () => toast.error('已删除') },
              ]}
            />
            <span className="text-body-sm text-ink-muted">← 键盘导航：Enter 打开 / ↑↓ 移动 / Esc 关闭</span>
          </div>
        </Card>
      </section>

      {/* ============ Toast ============ */}
      <section className="mb-14">
        <SectionTitle subtitle="顶部居中 · 走语义 token · 4 色 + loading">Toast</SectionTitle>
        <Card padding="md" className="flex flex-wrap gap-3">
          <Button size="sm" onClick={() => toast.success('操作成功')}>success</Button>
          <Button size="sm" variant="secondary" onClick={() => toast.info('这是一条提示')}>info</Button>
          <Button size="sm" variant="amber" onClick={() => toast.warning('请注意')}>warning</Button>
          <Button size="sm" variant="danger" onClick={() => toast.error('操作失败')}>error</Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const id = toast.loading('正在处理…')
              setTimeout(() => {
                toast.dismiss(id)
                toast.success('完成')
              }, 1200)
            }}
          >
            loading → success
          </Button>
        </Card>
      </section>

      {/* ============ Skeleton / Badge / Avatar ============ */}
      <section className="mb-14">
        <SectionTitle subtitle="Skeleton 呼吸 · Badge 7 tone · Avatar 图回落 initials + Group 叠加">
          Skeleton · Badge · Avatar
        </SectionTitle>
        <Card padding="md" className="grid md:grid-cols-2 gap-8">
          <div className="flex flex-col gap-3">
            <p className="text-caption text-ink-muted">Skeleton</p>
            <SkeletonCard />
            <div className="flex items-center gap-3">
              <SkeletonCircle size={48} />
              <div className="flex-1 flex flex-col gap-2">
                <SkeletonLine className="h-4 w-1/3" />
                <SkeletonLine className="h-3 w-1/2" />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-caption text-ink-muted mb-2">Badge · 7 tone</p>
              <div className="flex flex-wrap gap-2">
                <Badge tone="jade" dot>已发布</Badge>
                <Badge tone="amber">置顶</Badge>
                <Badge tone="rose">危险</Badge>
                <Badge tone="sky">信息</Badge>
                <Badge tone="violet">紫</Badge>
                <Badge tone="forest">森</Badge>
                <Badge>默认</Badge>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge size="md" tone="jade" dot>Medium 档</Badge>
                <Badge size="md" tone="amber" icon={<Star size={12} />}>带 icon</Badge>
              </div>
            </div>
            <div>
              <p className="text-caption text-ink-muted mb-2">Avatar · Group 叠加 + 溢出桶</p>
              <div className="flex items-center gap-6">
                <Avatar name="思源" size={48} />
                <Avatar name="Evan Smith" size={48} />
                <Avatar name="李" size={48} />
                <AvatarGroup max={3}>
                  <Avatar name="张三" />
                  <Avatar name="李四" />
                  <Avatar name="王五" />
                  <Avatar name="赵六" />
                  <Avatar name="孙七" />
                </AvatarGroup>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* ============ ScrollReveal ============ */}
      <section className="mb-14">
        <SectionTitle subtitle="往下滑 · motion whileInView + staggerChildren · 尊重 reduced-motion">
          ScrollReveal
        </SectionTitle>
        <ScrollRevealGroup className="grid md:grid-cols-3 gap-4" stagger={0.1}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <ScrollReveal key={i}>
              <Card padding="md" hoverable>
                <div className="flex items-baseline justify-between mb-2">
                  <h4 className="font-serif text-h4 text-ink-primary">第 {i} 张</h4>
                  <span className="font-serif text-num-lg text-brand">0{i}</span>
                </div>
                <p className="text-body text-ink-secondary">滚入视口时逐张揭开，stagger=0.1s。</p>
              </Card>
            </ScrollReveal>
          ))}
        </ScrollRevealGroup>
      </section>

      {/* ============ 底部说明 ============ */}
      <footer className="mt-16 pt-6 border-t border-border-default text-body-sm text-ink-muted">
        <p>
          Playground 仅在 <code className="font-mono text-ink-secondary">import.meta.env.DEV</code> 下挂载路由，
          不会出现在生产构建中。退出请访问 <code className="font-mono text-ink-secondary">/</code>。
        </p>
      </footer>
    </div>
  )
}

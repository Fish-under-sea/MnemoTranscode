/**
 * MTC 官网落地页 v2 — 情感叙事型设计
 *
 * 设计理念：「让记忆被看见」—— 以温暖治愈的视觉语言，
 * 讲述 AI 守护记忆的故事。采用叙事流滚动结构，
 * 配合柔和暖白 + 翠绿配色，营造沉浸式情感体验。
 */
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Monitor, Download, Smartphone, MessageCircle, Brain, Clock,
  Shield, Sparkles, Heart, ChevronRight, Users, Layers,
  ArrowRight, Quote, Star, Menu, X, Home
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/hooks/useAuthStore'
import LoginModal from '@/components/LoginModal'
import KouriChatLaunchModal from '@/components/kourichat/KouriChatLaunchModal'

// ========== 静态数据 ==========

const FEATURES = [
  {
    icon: Brain,
    title: 'AI 记忆整理',
    desc: 'LLM 自动总结、归类、时间线重建，让散落的记忆碎片有序排列',
    color: 'jade',
  },
  {
    icon: MessageCircle,
    title: '多渠道对话',
    desc: '网页、微信、QQ 均可与逝去的亲人对话，声音+记忆还原真实的人',
    color: 'jade',
  },
  {
    icon: Clock,
    title: '记忆时间线',
    desc: '可视化交互展示，按成员、年份、情感筛选，穿越时光找回记忆',
    color: 'jade',
  },
  {
    icon: Sparkles,
    title: 'AI 故事书',
    desc: '一键生成生命故事，支持多种风格，让回忆变成永恒的文字',
    color: 'amber',
  },
  {
    icon: Shield,
    title: '记忆胶囊',
    desc: '设定未来解封时间，定时推送，实现跨越时间的情感传承',
    color: 'jade',
  },
  {
    icon: Heart,
    title: '声音克隆',
    desc: '用克隆的声音读出文字，让逝者的声音穿越时空再次响起',
    color: 'amber',
  },
]

const TESTIMONIALS = [
  {
    quote: '终于能把爷爷的声音留下来了。那些教我下棋的午后、那些讲老故事的夜晚，都活过来了。',
    author: '林小姐，28岁',
    location: '福建福州',
    rating: 5,
  },
  {
    quote: '我把和奶奶的所有聊天记录都导入了，现在每天都能和她"对话"。她还是那么唠叨，那么温暖。',
    author: '张先生，35岁',
    location: '广东深圳',
    rating: 5,
  },
  {
    quote: '用 MTC 整理了外婆的一生，写成了故事书。家族里每个人都抢着要一本。',
    author: '陈小姐，32岁',
    location: '浙江杭州',
    rating: 5,
  },
]

const STATS = [
  { value: '6+', label: '档案类型', icon: Layers },
  { value: '10K+', label: '情感标签', icon: Heart },
  { value: '3', label: '对话渠道', icon: MessageCircle },
  { value: '∞', label: '记忆永恒', icon: Clock },
]

const ARCHIVE_TYPES = [
  { label: '家族记忆', desc: '世代传承的家族故事', color: 'bg-jade-100 text-jade-700' },
  { label: '恋人记忆', desc: '两个人的珍贵时光', color: 'bg-pink-100 text-pink-700' },
  { label: '挚友记忆', desc: '知交半生的情谊', color: 'bg-amber-100 text-amber-700' },
  { label: '至亲记忆', desc: '血浓于水的牵挂', color: 'bg-red-100 text-red-700' },
  { label: '伟人记忆', desc: '名留青史的风范', color: 'bg-violet-100 text-violet-700' },
  { label: '国家历史', desc: '民族的共同记忆', color: 'bg-sky-100 text-sky-700' },
]

// ========== 辅助 Hook ==========

/** 滚动触发动画 */
function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -60px 0px' }
    )

    const elements = document.querySelectorAll('.animate-on-scroll')
    elements.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [])
}

// ========== 子组件 ==========

/** 功能卡片 */
function FeatureCard({
  icon: Icon,
  title,
  desc,
  color,
  delay,
}: {
  icon: any
  title: string
  desc: string
  color: string
  delay: number
}) {
  const colorClasses =
    color === 'amber'
      ? 'group-hover:bg-amber-50 group-hover:border-amber-200 group-hover:shadow-warm'
      : 'group-hover:bg-jade-50 group-hover:border-jade-200 group-hover:shadow-glass'

  return (
    <div
      className={cn(
        'group relative p-8 rounded-3xl border border-warm-200 bg-white/60',
        'hover:bg-white hover:shadow-glass-lg transition-all duration-500',
        'animate-on-scroll cursor-default',
        colorClasses
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {/* 顶部装饰线 */}
      <div
        className={cn(
          'absolute top-0 left-8 right-8 h-0.5 rounded-b-full opacity-0 group-hover:opacity-100 transition-opacity duration-500',
          color === 'amber' ? 'bg-gradient-to-r from-transparent via-amber-400 to-transparent' : 'bg-gradient-to-r from-transparent via-jade-400 to-transparent'
        )}
      />

      <div
        className={cn(
          'w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-colors duration-300',
          color === 'amber' ? 'bg-amber-50 group-hover:bg-amber-100' : 'bg-jade-50 group-hover:bg-jade-100'
        )}
      >
        <Icon
          size={26}
          className={color === 'amber' ? 'text-amber-500' : 'text-jade-600'}
        />
      </div>

      <h3 className="font-display text-xl font-semibold text-slate-900 mb-3">{title}</h3>
      <p className="text-slate-500 leading-relaxed text-sm">{desc}</p>
    </div>
  )
}

/** 下载入口卡片 */
function DownloadCard({
  icon: Icon,
  tag,
  title,
  desc,
  action,
  primary,
  onClick,
  href,
}: {
  icon: any
  tag: string
  title: string
  desc: string
  action: string
  primary?: boolean
  onClick?: () => void
  href?: string
}) {
  const content = (
    <div
      className={cn(
        'relative rounded-3xl p-7 cursor-pointer transition-all duration-500 overflow-hidden group',
        primary
          ? 'bg-gradient-to-br from-jade-500 to-jade-600 text-white shadow-jade-lg hover:shadow-jade-lg hover:scale-[1.02]'
          : 'bg-white border border-warm-200 hover:border-jade-200 hover:shadow-glass hover:shadow-jade'
      )}
      onClick={onClick}
    >
      {/* 背景装饰 */}
      <div
        className={cn(
          'absolute -top-20 -right-20 w-40 h-40 rounded-full transition-transform duration-700 group-hover:scale-150',
          primary ? 'bg-white/10' : 'bg-jade-50'
        )}
      />

      <div className="relative flex items-start gap-5">
        <div
          className={cn(
            'w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors',
            primary ? 'bg-white/20' : 'bg-jade-50 group-hover:bg-jade-100'
          )}
        >
          <Icon
            size={28}
            className={primary ? 'text-white' : 'text-jade-600'}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div
            className={cn(
              'text-xs font-medium uppercase tracking-widest mb-2',
              primary ? 'text-jade-200' : 'text-jade-500'
            )}
          >
            {tag}
          </div>
          <h3
            className={cn(
              'text-xl font-display font-bold mb-2',
              primary ? 'text-white' : 'text-slate-900'
            )}
          >
            {title}
          </h3>
          <p
            className={cn(
              'text-sm leading-relaxed mb-5',
              primary ? 'text-jade-100' : 'text-slate-500'
            )}
          >
            {desc}
          </p>

          <div
            className={cn(
              'inline-flex items-center gap-2 text-sm font-semibold rounded-full px-5 py-2.5 transition-all duration-300',
              primary
                ? 'bg-white text-jade-700 hover:bg-jade-50'
                : 'bg-jade-50 text-jade-700 hover:bg-jade-100 border border-jade-200'
            )}
          >
            {action}
            <ArrowRight size={15} />
          </div>
        </div>
      </div>
    </div>
  )

  if (href) {
    return (
      <a href={href} className="block">
        {content}
      </a>
    )
  }
  return content
}

// ========== 主组件 ==========

export default function LandingPage() {
  const [activeTestimonial, setActiveTestimonial] = useState(0)
  const [showNotifyModal, setShowNotifyModal] = useState(false)
  const [showKouriChatModal, setShowKouriChatModal] = useState(false)
  const [notifyEmail, setNotifyEmail] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const navigate = useNavigate()
  const { isAuthenticated, checkAuth } = useAuthStore()

  // 每次落地页挂载时同步认证状态
  useEffect(() => {
    checkAuth()
  }, [])

  useScrollReveal()

  const nextTestimonial = () => {
    setActiveTestimonial((prev) => (prev + 1) % TESTIMONIALS.length)
  }

  const prevTestimonial = () => {
    setActiveTestimonial(
      (prev) => (prev - 1 + TESTIMONIALS.length) % TESTIMONIALS.length
    )
  }

  const navLinks = [
    { label: '功能', href: '#features' },
    { label: '档案类型', href: '#types' },
    { label: '下载', href: '#download' },
    { label: '用户故事', href: '#testimonials' },
  ]

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* ========== 浮动装饰背景 ========== */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        {/* 网格点阵 */}
        <div className="absolute inset-0 dot-grid-bg opacity-40" />
        {/* 暖色光斑 */}
        <div className="floating-orb w-[600px] h-[600px] bg-jade-200 top-[-200px] right-[-200px] animate-blob" style={{ animationDuration: '15s' }} />
        <div className="floating-orb w-[500px] h-[500px] bg-amber-100 bottom-[-150px] left-[-150px] animate-blob" style={{ animationDuration: '18s', animationDelay: '-5s' }} />
        <div className="floating-orb w-[300px] h-[300px] bg-jade-100 top-[40%] left-[60%] animate-blob" style={{ animationDuration: '12s', animationDelay: '-8s' }} />
      </div>

      {/* ========== 导航栏 ========== */}
      <header className="fixed top-4 left-4 right-4 z-50 glass-nav rounded-2xl shadow-glass">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-jade-400 to-jade-600 rounded-xl flex items-center justify-center shadow-jade">
                <span className="text-white font-bold text-xs tracking-tight">MTC</span>
              </div>
              <span className="font-display font-semibold text-slate-900 hidden sm:block">
                Memory To Code
              </span>
            </div>

            {/* 桌面导航 */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-jade-700 hover:bg-jade-50 rounded-xl transition-all duration-200"
                >
                  {link.label}
                </a>
              ))}
            </nav>

            {/* 行动按钮 */}
            <div className="flex items-center gap-2">
              {isAuthenticated ? (
                <button
                  onClick={() => navigate('/dashboard')}
                  className="hidden sm:inline-flex items-center px-4 py-2 text-sm text-jade-700 hover:text-jade-800 hover:bg-jade-50 rounded-xl transition-all duration-200 font-medium cursor-pointer"
                >
                  进入应用
                </button>
              ) : (
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="hidden sm:inline-flex items-center px-4 py-2 text-sm text-jade-700 hover:text-jade-800 hover:bg-jade-50 rounded-xl transition-all duration-200 font-medium cursor-pointer"
                >
                  登录
                </button>
              )}
              {!isAuthenticated && (
                <Link
                  to="/register"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-jade-500 text-white text-sm font-semibold rounded-xl hover:bg-jade-600 active:bg-jade-700 shadow-jade hover:shadow-jade-lg transition-all duration-300"
                >
                  开始使用
                  <ArrowRight size={14} />
                </Link>
              )}

              {/* 移动端菜单 */}
              <button
                className="md:hidden p-2 text-slate-600 hover:text-jade-700 hover:bg-jade-50 rounded-xl transition-colors"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* 移动端导航 */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-warm-200 px-5 py-3 space-y-1">
            {isAuthenticated ? (
              <a
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-3 text-sm text-jade-700 hover:bg-jade-50 rounded-xl transition-colors font-medium"
              >
                进入应用
              </a>
            ) : (
              <button
                onClick={() => { setMobileMenuOpen(false); setShowLoginModal(true) }}
                className="block w-full text-left px-4 py-3 text-sm text-jade-700 hover:bg-jade-50 rounded-xl transition-colors font-medium cursor-pointer"
              >
                登录
              </button>
            )}
            {!isAuthenticated && (
              <a
                href="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-3 text-sm text-slate-600 hover:text-jade-700 hover:bg-jade-50 rounded-xl transition-colors font-medium"
              >
                注册
              </a>
            )}
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-3 text-sm text-slate-600 hover:text-jade-700 hover:bg-jade-50 rounded-xl transition-colors font-medium"
              >
                {link.label}
              </a>
            ))}
          </nav>
        )}
      </header>

      {/* ========== Hero 区域 ========== */}
      <section className="relative pt-36 pb-24 px-5 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          {/* 标签 */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-jade-50 border border-jade-200 rounded-full mb-8 animate-on-scroll">
            <Sparkles size={13} className="text-jade-600" />
            <span className="text-xs font-semibold text-jade-700 tracking-wide">
              用 AI 守护每一段珍贵的记忆
            </span>
          </div>

          {/* 主标题 */}
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold text-slate-900 leading-[1.1] tracking-tight mb-8 animate-on-scroll delay-100">
            人的记忆是一种
            <br />
            <span className="gradient-text-jade">不讲道理</span>
            <br />
            的存储介质
          </h1>

          {/* 副标题 */}
          <p className="text-lg sm:text-xl text-slate-500 leading-relaxed max-w-2xl mx-auto mb-5 animate-on-scroll delay-200">
            这个项目存在的意义，就是把这些失衡的记忆碎片提取出来，
            完成从生物硬盘到数字硬盘的格式转换。
          </p>
          <p className="text-base text-slate-400 max-w-xl mx-auto mb-12 animate-on-scroll delay-300">
            当这些瞬间被脱离情绪、平铺在显示屏上时——
            留下的，只是一个具体的、真实的、曾在你的生命里留下过折痕的人。
          </p>

          {/* CTA 按钮组 */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20 animate-on-scroll delay-400">
            {isAuthenticated ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="btn-primary text-base px-8 py-4 rounded-2xl cursor-pointer"
              >
                <Monitor size={18} />
                进入网页版应用
              </button>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="btn-primary text-base px-8 py-4 rounded-2xl cursor-pointer"
              >
                <Monitor size={18} />
                登录进入应用
              </button>
            )}
            <a
              href="#download"
              className="btn-secondary text-base px-8 py-4 rounded-2xl"
            >
              <Download size={18} />
              下载客户端
            </a>
          </div>

          {/* 数据统计 */}
          <div className="grid grid-cols-4 gap-6 animate-on-scroll delay-500">
            {STATS.map((stat) => {
              const Icon = stat.icon
              return (
                <div key={stat.label} className="text-center group cursor-default">
                  <div className="w-12 h-12 mx-auto mb-3 bg-jade-50 rounded-2xl flex items-center justify-center group-hover:bg-jade-100 transition-colors duration-300">
                    <Icon size={20} className="text-jade-600" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-display font-bold text-slate-900">
                    {stat.value}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">{stat.label}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 装饰箭头 */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronRight size={20} className="text-jade-300 rotate-270" />
        </div>
      </section>

      {/* ========== 引言区 ========== */}
      <section className="py-20 px-5 sm:px-6 lg:px-8 relative">
        <div className="max-w-3xl mx-auto text-center">
          <div className="animate-on-scroll">
            <div className="w-16 h-16 mx-auto mb-8 bg-jade-50 rounded-3xl flex items-center justify-center">
              <Quote size={28} className="text-jade-400" />
            </div>
            <blockquote className="text-xl sm:text-2xl text-slate-700 font-display leading-relaxed space-y-4">
              <p>
                <span className="gradient-text-jade font-semibold">ta</span> 会在某个瞬间表现出近乎完美的体贴，
                也会在另一些日子里，迟钝、敷衍、甚至消失得理所当然。
              </p>
              <p className="text-slate-500 text-lg italic">
                是的，此刻，阳光在江面碎成一万个夏天，闪烁，又汇聚成一个冬天。
                这一切在你午睡时发生，你从未察觉。
              </p>
            </blockquote>
          </div>
        </div>
      </section>

      {/* ========== 功能展示 ========== */}
      <section id="features" className="py-24 px-5 sm:px-6 lg:px-8 bg-warm-100/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="animate-on-scroll inline-flex items-center gap-2 px-4 py-1.5 bg-jade-50 border border-jade-200 rounded-full mb-6">
              <Brain size={13} className="text-jade-600" />
              <span className="text-xs font-medium text-jade-700">核心能力</span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 mb-5 animate-on-scroll delay-100">
              不只是存储，是传承
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto animate-on-scroll delay-200">
              MTC 将 AI 能力融入记忆的每一个环节，让回忆不再是模糊的碎片，
              而是一段段清晰、可交互、可传承的永恒故事。
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <FeatureCard key={feature.title} {...feature} delay={i * 100} />
            ))}
          </div>
        </div>
      </section>

      {/* ========== 档案类型 ========== */}
      <section id="types" className="py-24 px-5 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 mb-5 animate-on-scroll">
              不只服务于家族
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto animate-on-scroll delay-100">
              MTC 可以承载多种类型的记忆档案。
              每一个档案，都是一段独一无二的生命故事。
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {ARCHIVE_TYPES.map((type, i) => (
              <div
                key={type.label}
                className={cn(
                  'animate-on-scroll rounded-2xl p-5 text-center transition-all duration-300 hover:scale-105 hover:shadow-glass cursor-default',
                  type.color
                )}
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-white/60 flex items-center justify-center font-display text-xl">
                  {type.label.charAt(0)}
                </div>
                <div className="font-semibold text-sm mb-1">{type.label}</div>
                <div className="text-xs opacity-70">{type.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== 三个入口 ========== */}
      <section id="download" className="py-24 px-5 sm:px-6 lg:px-8 bg-warm-100/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 mb-5 animate-on-scroll">
              选择你的使用方式
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto animate-on-scroll delay-100">
              MTC 提供多种使用方式。无论你在哪里，记忆始终与你同在。
            </p>
          </div>

          <div className="space-y-5">
            <DownloadCard
              icon={Monitor}
              tag="Web Application"
              title="网页版应用"
              desc="直接在浏览器中使用，无需下载安装。功能完整，支持所有浏览器。适合快速体验、日常使用。"
              action="立即体验"
              href="/dashboard"
              primary
            />
            <DownloadCard
              icon={MessageCircle}
              tag="WeChat Integration"
              title="KouriChat — 微信 AI 助手"
              desc="将 MTC 的 AI 能力接入微信。在微信里直接和逝去的亲人对话，像以前一样聊天。支持私聊和群聊，自动记忆上下文。"
              action="免费使用"
              onClick={() => setShowKouriChatModal(true)}
            />
            <DownloadCard
              icon={Smartphone}
              tag="Desktop & Mobile App"
              title="独立客户端应用"
              desc="Windows 原生应用和 Android APK。独立运行，功能更强大，支持本地数据管理、离线使用。Windows 和 Android 客户端开发中..."
              action="抢先预约"
              onClick={() => setShowNotifyModal(true)}
            />
          </div>
        </div>
      </section>

      {/* ========== 用户故事 ========== */}
      <section id="testimonials" className="py-24 px-5 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <div className="animate-on-scroll inline-flex items-center gap-2 px-4 py-1.5 bg-amber-50 border border-amber-200 rounded-full mb-6">
              <Heart size={13} className="text-amber-500" />
              <span className="text-xs font-medium text-amber-700">真实用户</span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 mb-5 animate-on-scroll delay-100">
              他们的故事
            </h2>
            <p className="text-slate-500 animate-on-scroll delay-200">
              每一段记忆都值得被守护
            </p>
          </div>

          <div className="animate-on-scroll delay-300">
            <div className="bg-white rounded-3xl border border-warm-200 p-8 sm:p-12 shadow-glass relative overflow-hidden">
              {/* 背景引号 */}
              <Quote size={80} className="absolute top-4 right-6 text-jade-100 select-none" />

              {/* 星级 */}
              <div className="flex gap-1 mb-6">
                {[...Array(TESTIMONIALS[activeTestimonial].rating)].map((_, i) => (
                  <Star key={i} size={16} className="text-amber-400 fill-amber-400" />
                ))}
              </div>

              {/* 引用文字 */}
              <blockquote className="text-lg sm:text-xl text-slate-700 leading-relaxed mb-8 relative">
                "{TESTIMONIALS[activeTestimonial].quote}"
              </blockquote>

              {/* 用户信息 */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-jade-100 rounded-full flex items-center justify-center">
                  <Users size={18} className="text-jade-600" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900 text-sm">
                    {TESTIMONIALS[activeTestimonial].author}
                  </div>
                  <div className="text-xs text-slate-400">
                    {TESTIMONIALS[activeTestimonial].location}
                  </div>
                </div>
              </div>
            </div>

            {/* 轮播控制 */}
            <div className="flex items-center justify-center gap-3 mt-8">
              <button
                onClick={prevTestimonial}
                className="w-11 h-11 rounded-full border border-warm-200 bg-white hover:bg-jade-50 hover:border-jade-200 flex items-center justify-center transition-all duration-200 cursor-pointer"
              >
                <ChevronRight size={18} className="rotate-180 text-slate-600" />
              </button>
              <div className="flex gap-2">
                {TESTIMONIALS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveTestimonial(i)}
                    className={cn(
                      'h-2 rounded-full transition-all duration-300 cursor-pointer',
                      i === activeTestimonial
                        ? 'bg-jade-500 w-7'
                        : 'bg-slate-200 w-2 hover:bg-jade-300'
                    )}
                  />
                ))}
              </div>
              <button
                onClick={nextTestimonial}
                className="w-11 h-11 rounded-full border border-warm-200 bg-white hover:bg-jade-50 hover:border-jade-200 flex items-center justify-center transition-all duration-200 cursor-pointer"
              >
                <ChevronRight size={18} className="text-slate-600" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ========== 尾声 CTA ========== */}
      <section className="py-24 px-5 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* 背景 */}
        <div className="absolute inset-0 bg-gradient-to-br from-jade-500 via-jade-600 to-jade-700" />
        <div className="absolute inset-0 opacity-20 dot-grid-bg" />

        <div className="relative max-w-3xl mx-auto text-center text-white">
          <div className="animate-on-scroll inline-flex items-center gap-2 px-4 py-1.5 bg-white/20 rounded-full mb-8">
            <Heart size={13} />
            <span className="text-xs font-medium">每一个生命都值得被铭记</span>
          </div>

          <h2 className="font-display text-3xl sm:text-4xl font-bold leading-snug mb-6 animate-on-scroll delay-100">
            留下，只是一个具体的、真实的、
            <br />曾在你的生命里留下过折痕的人。
          </h2>

          <p className="text-jade-100 text-lg mb-10 animate-on-scroll delay-200">
            当这个项目运行结束，那些被神化或被模糊的轮廓终将消失。
            剩下的，是平凡而真实的 ta。
          </p>

          <Link
            to="/register"
            className="animate-on-scroll delay-300 inline-flex items-center gap-2 px-9 py-4 bg-white text-jade-700 text-base font-semibold rounded-2xl hover:bg-jade-50 transition-all duration-300 shadow-jade-lg hover:shadow-warm"
          >
            <Sparkles size={17} />
            开始守护记忆
          </Link>
        </div>
      </section>

      {/* ========== 页脚 ========== */}
      <footer className="bg-slate-900 text-slate-400 py-12 px-5 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            {/* Logo & 版权 */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-jade-400 to-jade-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-xs">MTC</span>
              </div>
              <div>
                <div className="font-display font-semibold text-white">Memory To Code</div>
                <div className="text-xs mt-0.5 text-slate-500">MnemoTranscode · MIT License</div>
              </div>
            </div>

            {/* 链接 */}
            <div className="flex flex-wrap gap-6 text-sm">
              <a
                href="https://github.com/Fish-under-sea/MnemoTranscode"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                GitHub
              </a>
              <a href="#features" className="hover:text-white transition-colors">功能</a>
              <a href="#download" className="hover:text-white transition-colors">下载</a>
              <Link to="/docs" className="hover:text-white transition-colors">文档</Link>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <span>© 2026 MTC — Memory To Code. 用 AI 守护每一段珍贵的记忆。</span>
            <span>MIT License · Open Source · v1.0.1</span>
          </div>
        </div>
      </footer>

      {/* ========== 客户端下载通知弹窗 ========== */}
      {showNotifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setShowNotifyModal(false)}
          />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-on-scroll">
            <div className="text-center mb-7">
              <div className="w-16 h-16 mx-auto mb-5 bg-jade-50 rounded-2xl flex items-center justify-center">
                <Layers size={30} className="text-jade-600" />
              </div>
              <h3 className="font-display text-xl font-bold text-slate-900 mb-2">
                客户端即将发布
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Windows 桌面应用和 Android APK 正在开发中。
                留下邮箱，发布时第一时间通知你。
              </p>
            </div>

            <div className="space-y-3">
              <input
                type="email"
                value={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-3 border border-warm-200 rounded-xl focus:ring-2 focus:ring-jade-400 focus:border-jade-400 outline-none text-sm bg-warm-50"
              />
              <button
                onClick={() => {
                  if (notifyEmail) {
                    setShowNotifyModal(false)
                    setNotifyEmail('')
                  }
                }}
                disabled={!notifyEmail}
                className="w-full py-3 bg-jade-500 text-white rounded-xl font-semibold text-sm hover:bg-jade-600 active:bg-jade-700 disabled:opacity-40 transition-colors cursor-pointer"
              >
                订阅通知
              </button>
              <button
                onClick={() => setShowNotifyModal(false)}
                className="w-full py-2 text-sm text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                稍后再说
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KouriChat 启动弹窗 */}
      {showKouriChatModal && (
        <KouriChatLaunchModal onClose={() => setShowKouriChatModal(false)} />
      )}

      {/* 登录弹窗 */}
      {showLoginModal && (
        <LoginModal onClose={() => setShowLoginModal(false)} returnTo="/dashboard" />
      )}
    </div>
  )
}

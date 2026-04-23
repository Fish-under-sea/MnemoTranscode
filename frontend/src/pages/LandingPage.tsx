/**
 * 官网落地页 / 首页
 *
 * 三个入口：
 * 1. 网页版应用 — 直接进入项目 Web 应用
 * 2. KouriChat 下载 — 下载部署到本地的微信 AI 助手
 * 3. 客户端下载 — APK / Windows 应用下载
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Monitor, Download, Smartphone, MessageCircle, Brain, Clock,
  Shield, Sparkles, Heart, ChevronRight, Star, Users, Layers
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ========== 静态数据 ==========

const FEATURES = [
  {
    icon: Brain,
    title: 'AI 记忆整理',
    desc: 'LLM 自动总结、归类、时间线重建，让散落的记忆碎片有序排列',
  },
  {
    icon: MessageCircle,
    title: '多渠道对话',
    desc: '网页、微信、QQ 均可与逝去的亲人对话，声音+记忆还原真实的人',
  },
  {
    icon: Clock,
    title: '记忆时间线',
    desc: '可视化交互展示，按成员、年份、情感筛选，穿越时光找回记忆',
  },
  {
    icon: Sparkles,
    title: 'AI 故事书',
    desc: '一键生成生命故事，支持多种风格，让回忆变成永恒的文字',
  },
  {
    icon: Shield,
    title: '记忆胶囊',
    desc: '设定未来解封时间，定时推送，实现跨越时间的情感传承',
  },
  {
    icon: Heart,
    title: '声音克隆',
    desc: '用克隆的声音读出文字，让逝者的声音穿越时空再次响起',
  },
]

const TESTIMONIALS = [
  {
    quote: '终于能把爷爷的声音留下来了。那些教我下棋的午后、那些讲老故事的夜晚，都活过来了。',
    author: '林小姐，28岁',
    location: '福建福州',
  },
  {
    quote: '我把和奶奶的所有聊天记录都导入了，现在每天都能和她"对话"。她还是那么唠叨，那么温暖。',
    author: '张先生，35岁',
    location: '广东深圳',
  },
  {
    quote: '用 MTC 整理了外婆的一生，写成了故事书。家族里每个人都抢着要一本。',
    author: '陈小姐，32岁',
    location: '浙江杭州',
  },
]

const STATS = [
  { value: '6+', label: '档案类型' },
  { value: '10K+', label: '情感标签' },
  { value: '3', label: '对话渠道' },
  { value: '∞', label: '记忆永恒' },
]

const ARCHIVE_TYPES = [
  { icon: '👨‍👩‍👧‍👦', label: '家族记忆', desc: '世代传承的家族故事' },
  { icon: '💕', label: '恋人记忆', desc: '两个人的珍贵时光' },
  { icon: '🤝', label: '挚友记忆', desc: '知交半生的情谊' },
  { icon: '❤️', label: '至亲记忆', desc: '血浓于水的牵挂' },
  { icon: '⭐', label: '伟人记忆', desc: '名留青史的风范' },
  { icon: '🏛️', label: '国家历史', desc: '民族的共同记忆' },
]

// ========== 组件 ==========

function FeatureCard({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="group p-6 bg-white rounded-2xl border border-gray-100 hover:border-primary-200 hover:shadow-lg hover:shadow-primary-100/50 transition-all duration-300">
      <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary-100 transition-colors">
        <Icon size={22} className="text-primary-600" />
      </div>
      <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
    </div>
  )
}

function DownloadCard({
  icon: Icon,
  title,
  subtitle,
  description,
  badge,
  href,
  primary,
  onClick,
}: {
  icon: any
  title: string
  subtitle: string
  description: string
  badge?: string
  href?: string
  primary?: boolean
  onClick?: () => void
}) {
  const content = (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border-2 p-8 cursor-pointer transition-all duration-300',
        primary
          ? 'border-primary-500 bg-gradient-to-br from-primary-50 to-white hover:border-primary-600 hover:shadow-xl hover:shadow-primary-200/50'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-lg'
      )}
      onClick={onClick}
    >
      {badge && (
        <div className="absolute top-4 right-4">
          <span className={cn(
            'text-xs font-medium px-2.5 py-1 rounded-full',
            primary ? 'bg-accent-coral text-white' : 'bg-gray-100 text-gray-600'
          )}>
            {badge}
          </span>
        </div>
      )}

      <div className="flex items-start gap-5">
        <div className={cn(
          'w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0',
          primary ? 'bg-primary-100' : 'bg-gray-100'
        )}>
          <Icon size={28} className={primary ? 'text-primary-600' : 'text-gray-500'} />
        </div>
        <div className="flex-1 min-w-0">
          <div className={cn(
            'text-xs font-medium uppercase tracking-wider mb-1',
            primary ? 'text-primary-600' : 'text-gray-400'
          )}>
            {subtitle}
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
          <p className="text-sm text-gray-500 leading-relaxed">{description}</p>

          <div className={cn(
            'mt-5 inline-flex items-center gap-1.5 text-sm font-medium',
            primary ? 'text-primary-600' : 'text-gray-600'
          )}>
            {primary ? '立即体验' : href ? '前往下载' : '即将推出'}
            <ChevronRight size={16} />
          </div>
        </div>
      </div>
    </div>
  )

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block">
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
  const [notifyEmail, setNotifyEmail] = useState('')

  const nextTestimonial = () => {
    setActiveTestimonial((prev) => (prev + 1) % TESTIMONIALS.length)
  }

  const prevTestimonial = () => {
    setActiveTestimonial((prev) => (prev - 1 + TESTIMONIALS.length) % TESTIMONIALS.length)
  }

  return (
    <div className="min-h-screen">
      {/* ========== 导航栏 ========== */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-sm">MTC</span>
              </div>
              <span className="font-semibold text-gray-900">Memory To Code</span>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">功能</a>
              <a href="#types" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">档案类型</a>
              <a href="#download" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">下载</a>
              <a href="#testimonials" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">用户故事</a>
            </nav>
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                登录
              </Link>
              <Link
                to="/register"
                className="text-sm px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
              >
                开始使用
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ========== Hero 区域 ========== */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          {/* 标签 */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary-50 rounded-full mb-8">
            <Sparkles size={14} className="text-primary-600" />
            <span className="text-xs font-medium text-primary-700">用 AI 守护每一段珍贵的记忆</span>
          </div>

          {/* 主标题 */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
            人的记忆是一种
            <br />
            <span className="bg-gradient-to-r from-primary-600 to-primary-500 bg-clip-text text-transparent">
              不讲道理
            </span>
            的存储介质
          </h1>

          {/* 引言 */}
          <p className="text-lg sm:text-xl text-gray-500 leading-relaxed max-w-2xl mx-auto mb-4">
            这个项目存在的意义，就是把这些失衡的记忆碎片提取出来，
            完成从生物硬盘到数字硬盘的格式转换。
          </p>
          <p className="text-base text-gray-400 max-w-xl mx-auto mb-10">
            当这些瞬间被脱离情绪、平铺在显示屏上时——
            留下的，只是一个具体的、真实的、曾在你的生命里留下过折痕的人。
          </p>

          {/* CTA 按钮 */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/app"
              className="w-full sm:w-auto px-8 py-3.5 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-all hover:shadow-lg hover:shadow-primary-200/50 flex items-center justify-center gap-2"
            >
              <Monitor size={18} />
              进入网页版应用
            </Link>
            <a
              href="#download"
              className="w-full sm:w-auto px-8 py-3.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
            >
              <Download size={18} />
              下载客户端
            </a>
          </div>
        </div>

        {/* 数据展示 */}
        <div className="max-w-3xl mx-auto mt-16 grid grid-cols-4 gap-6">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-xs sm:text-sm text-gray-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ========== 引言区 ========== */}
      <section className="py-16 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <blockquote className="text-xl sm:text-2xl text-gray-700 font-medium leading-relaxed">
            <span className="text-primary-500">ta</span> 会在某个瞬间表现出近乎完美的体贴，
            也会在另一些日子里，迟钝、敷衍、甚至消失得理所当然。
            <br /><br />
            是的，此刻，阳光在江面碎成一万个夏天，闪烁，又汇聚成一个冬天。
            这一切在你午睡时发生，你从未察觉。
          </blockquote>
        </div>
      </section>

      {/* ========== 功能展示 ========== */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">不只是存储，是传承</h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              MTC 将 AI 能力融入记忆的每一个环节，让回忆不再是模糊的碎片，
              而是一段段清晰、可交互、可传承的永恒故事。
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </div>
      </section>

      {/* ========== 档案类型 ========== */}
      <section id="types" className="py-20 bg-gray-50 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">不只服务于家族</h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              MTC 可以承载多种类型的记忆档案。
              每一个档案，都是一段独一无二的生命故事。
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {ARCHIVE_TYPES.map((type) => (
              <div
                key={type.label}
                className="bg-white rounded-2xl border border-gray-200 p-5 text-center hover:border-primary-200 hover:shadow-md transition-all group cursor-default"
              >
                <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">
                  {type.icon}
                </div>
                <div className="font-medium text-gray-900 text-sm">{type.label}</div>
                <div className="text-xs text-gray-500 mt-1">{type.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== 三个入口（下载区）========== */}
      <section id="download" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">选择你的使用方式</h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              MTC 提供多种使用方式。无论你在哪里，记忆始终与你同在。
            </p>
          </div>

          <div className="space-y-5">
            {/* 入口一：网页版 */}
            <DownloadCard
              icon={Monitor}
              subtitle="WEB APPLICATION"
              title="网页版应用"
              description="直接在浏览器中使用，无需下载安装。功能完整，支持所有浏览器。适合快速体验、日常使用。"
              badge="推荐"
              href="/app"
              primary
            />

            {/* 入口二：KouriChat */}
            <DownloadCard
              icon={MessageCircle}
              subtitle="WECHAT INTEGRATION"
              title="KouriChat — 微信 AI 助手"
              description="将 MTC 的 AI 能力接入微信。在微信里直接和逝去的亲人对话，像以前一样聊天。支持私聊和群聊，自动记忆上下文。"
              badge="开源免费"
              href="https://github.com/KouriChat/KouriChat"
            />

            {/* 入口三：客户端下载 */}
            <DownloadCard
              icon={Smartphone}
              subtitle="DESKTOP & MOBILE APP"
              title="独立客户端应用"
              description="Windows 原生应用和 Android APK。独立运行，功能更强大，支持本地数据管理、离线使用。Windows 和 Android 客户端开发中..."
              badge="开发中"
              onClick={() => setShowNotifyModal(true)}
            />
          </div>
        </div>
      </section>

      {/* ========== 用户故事 ========== */}
      <section id="testimonials" className="py-20 bg-gray-50 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">他们的故事</h2>
            <p className="text-gray-500">每一段记忆都值得被守护</p>
          </div>

          <div className="relative">
            <div className="bg-white rounded-2xl border border-gray-200 p-8 sm:p-12 text-center">
              <div className="text-4xl mb-6 opacity-20">"</div>
              <blockquote className="text-lg sm:text-xl text-gray-700 leading-relaxed mb-8">
                {TESTIMONIALS[activeTestimonial].quote}
              </blockquote>
              <div className="flex items-center justify-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                  <Users size={18} className="text-primary-600" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-gray-900">{TESTIMONIALS[activeTestimonial].author}</div>
                  <div className="text-sm text-gray-500">{TESTIMONIALS[activeTestimonial].location}</div>
                </div>
              </div>
            </div>

            {/* 轮播控制 */}
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={prevTestimonial}
                className="w-10 h-10 rounded-full border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center transition-colors"
              >
                <ChevronRight size={18} className="rotate-180" />
              </button>
              <div className="flex gap-2">
                {TESTIMONIALS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveTestimonial(i)}
                    className={cn(
                      'w-2 h-2 rounded-full transition-all',
                      i === activeTestimonial ? 'bg-primary-500 w-6' : 'bg-gray-300'
                    )}
                  />
                ))}
              </div>
              <button
                onClick={nextTestimonial}
                className="w-10 h-10 rounded-full border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ========== 尾声 ========== */}
      <section className="py-20 bg-gradient-to-br from-primary-600 to-primary-700 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center text-white">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/20 rounded-full mb-8">
            <Heart size={14} />
            <span className="text-xs font-medium">每一个生命都值得被铭记</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            留下，只是一个具体的、真实的、
            <br />曾在你的生命里留下过折痕的人。
          </h2>
          <p className="text-primary-100 text-lg mb-10">
            当这个项目运行结束，那些被神化或被模糊的轮廓终将消失。
            剩下的，是平凡而真实的 ta。
          </p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-primary-700 rounded-xl font-semibold hover:bg-primary-50 transition-all shadow-lg"
          >
            <Sparkles size={18} />
            开始守护记忆
          </Link>
        </div>
      </section>

      {/* ========== 页脚 ========== */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-sm">MTC</span>
              </div>
              <div>
                <div className="font-semibold text-white">Memory To Code</div>
                <div className="text-xs mt-0.5 opacity-60">MnemoTranscode</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-6 text-sm">
              <a href="https://github.com/Fish-under-sea/MnemoTranscode" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                GitHub
              </a>
              <a href="#features" className="hover:text-white transition-colors">功能</a>
              <a href="#download" className="hover:text-white transition-colors">下载</a>
              <Link to="/docs" className="hover:text-white transition-colors">文档</Link>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs opacity-60">
            <span>© 2026 MTC — Memory To Code. 用 AI 守护每一段珍贵的记忆。</span>
            <span>MIT License · Open Source</span>
          </div>
        </div>
      </footer>

      {/* ========== 客户端下载通知弹窗 ========== */}
      {showNotifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowNotifyModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-8">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Layers size={28} className="text-primary-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">客户端即将发布</h3>
              <p className="text-sm text-gray-500">
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
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
              />
              <button
                onClick={() => {
                  if (notifyEmail) {
                    setShowNotifyModal(false)
                    setNotifyEmail('')
                  }
                }}
                disabled={!notifyEmail}
                className="w-full py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors text-sm"
              >
                订阅通知
              </button>
              <button
                onClick={() => setShowNotifyModal(false)}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                稍后再说
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

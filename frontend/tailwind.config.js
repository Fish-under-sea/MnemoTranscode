/** @type {import('tailwindcss').Config} */
// 子项目 A · 设计系统 Tailwind 配置
// ---------------------------------------------------------------
// 对应 docs/design-system.md §3/§4。
//
// 扩展原则（docs/superpowers/plans/2026-04-24-A-design-system-plan.md M1·任务 3）：
//   1. 所有旧色板（warm/jade/amber/rose/sky/violet/forest/primary/slate）全部保留，
//      防止现有 14+ 页面出现退化；`primary` 色板待子项目 B/C 重做页面后再清。
//   2. 新增 fontFamily.serif（思源宋）、fontFamily.mono；display 主字族切到思源宋，
//      Outfit 保留作兜底，font-body 保留指向思源黑（兜底 Work Sans）。
//   3. 新增 fontSize 字阶（display / h1-h4 / body-* / caption / quote / num-lg），
//      不覆盖 Tailwind 默认 text-sm/base/lg/xl，新组件用新 key。
//   4. 覆盖 borderRadius sm→3xl（6/10/14/20/24/32px）——这是设计系统的统一圆角语言，
//      旧页面会略圆润（预期），属 M1 复核点要看的变化之一。
//   5. 新增 elevation 阴影 e1-e5，走 CSS 变量 --shadow-color，暗色下自动适配。
//   6. 语义色 canvas/surface/subtle/muted/ink.*/brand.* 从 tokens.css CSS 变量读，
//      作为新 UI 组件的主通路；旧色板保留让迁移可以渐进。
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ====== 原色板：保留（旧页面在用） ======
        warm: {
          50:  '#FEFEF9',
          100: '#FDFBF2',
          200: '#FAF7E6',
          300: '#F5F0D6',
        },
        jade: {
          50:  '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
          950: '#022C22',
        },
        amber: {
          50:  '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
        },
        rose: {
          50:  '#FFF1F2',
          100: '#FFE4E6',
          200: '#FECDD3',
          300: '#FDA4AF',
          400: '#FB7185',
          500: '#F43F5E',
          600: '#E11D48',
          700: '#BE123C',
        },
        sky: {
          50:  '#F0F9FF',
          100: '#E0F2FE',
          200: '#BAE6FD',
          300: '#7DD3FC',
          400: '#38BDF8',
          500: '#0EA5E9',
          600: '#0284C7',
          700: '#0369A1',
        },
        violet: {
          50:  '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',
          700: '#6D28D9',
        },
        forest: {
          50:  '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          300: '#86EFAC',
          400: '#4ADE80',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
        },
        slate: {
          450: '#64748B',
        },
        // 旧紫色主色：保留至子项目 B/C 清理前
        primary: {
          50:  '#f0f0ff',
          100: '#e0e0ff',
          200: '#c7c7fe',
          300: '#a5a3fc',
          400: '#8b87f5',
          500: '#7c75ed',
          600: '#6b64d4',
          700: '#5c52b5',
          800: '#4d4595',
          900: '#3f3a78',
          950: '#2a2750',
        },

        // ====== 语义令牌：从 tokens.css CSS 变量读取 ======
        // 用法：bg-canvas / bg-surface / text-ink-primary / bg-brand / bg-brand-hover
        canvas: 'var(--bg-canvas)',
        surface: 'var(--bg-surface)',
        subtle: 'var(--bg-subtle)',
        muted: 'var(--bg-muted)',
        ink: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          inverse: 'var(--text-inverse)',
        },
        brand: {
          DEFAULT: 'var(--brand-primary)',
          hover: 'var(--brand-primary-hover)',
          active: 'var(--brand-primary-active)',
          accent: 'var(--brand-accent)',
        },
        'border-default': 'var(--border-default)',
      },
      spacing: {
        13: '3.25rem',
      },

      fontFamily: {
        // design-system.md §3.1 · 双字族策略
        sans:    ['"Noto Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', '"Outfit"', 'system-ui', 'sans-serif'],
        serif:   ['"Noto Serif SC"', '"Songti SC"', '"SimSun"', 'Georgia', 'serif'],
        // display：标题 / 数字 / 引用 —— 主用思源宋，Outfit 作兜底避免旧页面骤变
        display: ['"Noto Serif SC"', '"Outfit"', '"Noto Sans SC"', 'serif'],
        // 旧 body 类：保留兜底，指向思源黑后备 Work Sans（14+ 页面仍引用）
        body:    ['"Noto Sans SC"', '"Work Sans"', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },

      fontSize: {
        // design-system.md §3.3 · 字阶（与 Tailwind 默认 text-sm/base/lg/xl 并存）
        'display':  ['3.5rem',   { lineHeight: '1.15', fontWeight: '500' }],
        'h1':       ['2.5rem',   { lineHeight: '1.2',  fontWeight: '500' }],
        'h2':       ['2rem',     { lineHeight: '1.25', fontWeight: '500' }],
        'h3':       ['1.5rem',   { lineHeight: '1.3',  fontWeight: '600' }],
        'h4':       ['1.25rem',  { lineHeight: '1.4',  fontWeight: '600' }],
        'body-lg':  ['1.0625rem',{ lineHeight: '1.75' }],
        'body':     ['0.9375rem',{ lineHeight: '1.7'  }],
        'body-sm':  ['0.8125rem',{ lineHeight: '1.6'  }],
        'caption':  ['0.75rem',  { lineHeight: '1.5',  fontWeight: '500' }],
        'quote':    ['1.375rem', { lineHeight: '1.8',  fontStyle: 'italic' }],
        'num-lg':   ['3rem',     { lineHeight: '1',    fontWeight: '500', fontVariantNumeric: 'tabular-nums' }],
      },

      borderRadius: {
        // design-system.md §4.2 · 覆盖默认，建立统一圆角语言
        // 旧页面 rounded-xl/2xl 会略微变大（16→20, 16→24），属预期温润化
        'sm':  '6px',
        'md':  '10px',
        'lg':  '14px',
        'xl':  '20px',
        '2xl': '24px',
        '3xl': '32px',
      },

      boxShadow: {
        // design-system.md §4.3 · elevation 系统（基色跟主题）
        'e1': '0 1px 2px rgba(var(--shadow-color), 0.05)',
        'e2': '0 4px 12px rgba(var(--shadow-color), 0.08)',
        'e3': '0 12px 32px rgba(var(--shadow-color), 0.12)',
        'e4': '0 24px 64px rgba(var(--shadow-color), 0.16)',
        'e5': '0 32px 96px rgba(var(--shadow-color), 0.20)',
        // 保留旧项避免破坏现有页面
        'glass':    '0 8px 32px 0 rgba(5, 150, 105, 0.08)',
        'glass-lg': '0 16px 48px 0 rgba(5, 150, 105, 0.12)',
        'jade':     '0 4px 24px 0 rgba(5, 150, 105, 0.25)',
        'jade-lg':  '0 8px 40px 0 rgba(5, 150, 105, 0.35)',
        'warm':     '0 4px 24px 0 rgba(161, 98, 7, 0.08)',
        'rose':     '0 4px 24px 0 rgba(244, 63, 94, 0.15)',
        'sky':      '0 4px 24px 0 rgba(14, 165, 233, 0.15)',
        'violet':   '0 4px 24px 0 rgba(139, 92, 246, 0.15)',
        'forest':   '0 4px 24px 0 rgba(34, 197, 94, 0.15)',
      },

      backdropBlur: {
        xs: '2px',
      },

      // 旧缓动 / 动画保留（旧页面的 animate-fade-up 等还在用）
      // 新组件统一走 motion preset（lib/motion.ts），不再扩 CSS keyframes。
      ease: {
        'expo-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'spring':   'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      animation: {
        'fade-in':    'fadeIn 0.6s ease-out forwards',
        'fade-up':    'fadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-in':   'slideIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'float':      'float 6s ease-in-out infinite',
        'pulse-soft': 'pulseSoft 3s ease-in-out infinite',
        'shimmer':    'shimmer 2s linear infinite',
        'count-up':   'countUp 2s ease-out forwards',
        'blob':       'blob 7s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        blob: {
          '0%, 100%': { borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%' },
          '50%': { borderRadius: '30% 60% 70% 40% / 50% 60% 30% 60%' },
        },
      },
    },
  },
  plugins: [],
}

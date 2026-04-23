/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 柔和暖白主背景
        warm: {
          50:  '#FEFEF9',
          100: '#FDFBF2',
          200: '#FAF7E6',
          300: '#F5F0D6',
        },
        // 翠绿 / 翡翠绿 — 主品牌色
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
        // 琥珀色点缀（CTA）
        amber: {
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
        },
        // 柔和的蓝灰色文字
        slate: {
          450: '#64748B',
        },
        // 保留原有主色作为辅助
        primary: {
          50: '#f0f0ff',
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
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', '"Outfit"', '"Work Sans"', 'system-ui', 'sans-serif'],
        display: ['"Outfit"', '"Noto Sans SC"', 'system-ui', 'sans-serif'],
        body: ['"Work Sans"', '"Noto Sans SC"', 'system-ui', 'sans-serif'],
      },
      // 动效缓动曲线
      ease: {
        'expo-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      // 动画时长
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'fade-up': 'fadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-in': 'slideIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'float': 'float 6s ease-in-out infinite',
        'pulse-soft': 'pulseSoft 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'count-up': 'countUp 2s ease-out forwards',
        'blob': 'blob 7s ease-in-out infinite',
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
      // 玻璃态效果
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(5, 150, 105, 0.08)',
        'glass-lg': '0 16px 48px 0 rgba(5, 150, 105, 0.12)',
        'jade': '0 4px 24px 0 rgba(5, 150, 105, 0.25)',
        'jade-lg': '0 8px 40px 0 rgba(5, 150, 105, 0.35)',
        'warm': '0 4px 24px 0 rgba(161, 98, 7, 0.08)',
      },
    },
  },
  plugins: [],
}

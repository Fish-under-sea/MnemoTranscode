/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
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
        accent: {
          green: '#5DCAA5',
          orange: '#EF9F27',
          coral: '#F0997B',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

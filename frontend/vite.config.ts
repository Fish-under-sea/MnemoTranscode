import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        // 大文件经 Vite 转发时避免默认超时导致浏览器 Network Error
        timeout: 600_000,
        proxyTimeout: 600_000,
      },
      '/kourichat-proxy': {
        target: 'http://localhost:8502',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/kourichat-proxy/, ''),
        ws: true,
      },
    },
  },
})

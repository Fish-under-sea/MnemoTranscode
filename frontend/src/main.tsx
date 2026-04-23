import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 关闭重试，避免 401 时重复触发 logout 导致 token 被清空
      retry: false,
      staleTime: 5 * 60 * 1000,
    },
  },
})

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[MTC ErrorBoundary]', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#FEFEF9',
          padding: '2rem',
        }}>
          <div style={{ textAlign: 'center', maxWidth: 480 }}>
            <h1 style={{ color: '#059669', marginBottom: 16, fontSize: 24 }}>
              页面加载遇到问题
            </h1>
            <pre style={{
              background: '#fee2e2',
              border: '1px solid #fca5a5',
              borderRadius: 8,
              padding: 16,
              textAlign: 'left',
              fontSize: 12,
              color: '#991b1b',
              overflow: 'auto',
              maxHeight: 200,
            }}>
              {this.state.error?.message}
            </pre>
            <p style={{ color: '#64748b', marginTop: 16, fontSize: 14 }}>
              请按 F12 打开开发者工具 → Console 查看详细错误信息。
            </p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#1a2e1a',
                color: '#fff',
              },
            }}
          />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)

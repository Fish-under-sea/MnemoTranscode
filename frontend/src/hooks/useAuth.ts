/**
 * 认证钩子 - 直接从 localStorage 读取，无任何中间状态
 */
export function useAuth() {
  const token = localStorage.getItem('mtc-token')
  const userRaw = localStorage.getItem('mtc-user')
  let user = null
  if (userRaw) {
    try { user = JSON.parse(userRaw) } catch { /* ignore */ }
  }
  return {
    isAuthenticated: !!token,
    token,
    user,
  }
}

export function setAuth(token: string, user: object) {
  localStorage.setItem('mtc-token', token)
  localStorage.setItem('mtc-user', JSON.stringify(user))
}

export function clearAuth() {
  localStorage.removeItem('mtc-token')
  localStorage.removeItem('mtc-user')
}

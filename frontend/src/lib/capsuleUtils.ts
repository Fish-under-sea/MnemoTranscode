// frontend/src/lib/capsuleUtils.ts

/**
 * 将 unlock_date ISO 字符串格式化为可读倒计时
 * 返回例："29 天 23 时" | "3 时 12 分" | "已到期"
 */
export function formatCountdown(unlockDateIso: string): string {
  const now = Date.now()
  const target = new Date(unlockDateIso).getTime()
  const diffMs = target - now

  if (diffMs <= 0) return '已到期'

  const totalMinutes = Math.floor(diffMs / 60_000)
  const totalHours = Math.floor(totalMinutes / 60)
  const totalDays = Math.floor(totalHours / 24)

  if (totalDays >= 1) {
    const remainHours = totalHours - totalDays * 24
    return `${totalDays} 天 ${remainHours} 时`
  }
  if (totalHours >= 1) {
    const remainMinutes = totalMinutes - totalHours * 60
    return `${totalHours} 时 ${remainMinutes} 分`
  }
  return `${totalMinutes} 分钟`
}

/**
 * 判断胶囊是否处于锁定状态（unlock_date 在未来）
 */
export function isCapsuleLocked(unlockDateIso: string): boolean {
  return new Date(unlockDateIso).getTime() > Date.now()
}

/**
 * 格式化日期为 "YYYY 年 MM 月 DD 日"
 */
export function formatDate(isoString: string): string {
  const d = new Date(isoString)
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

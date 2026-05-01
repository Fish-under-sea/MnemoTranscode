/** 字节 → 人类可读体积（与仪表盘、个人中心共用） */

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

/** 对接 GET /usage/stats：优先用后端百分比，否则由 used/quota 推算 */
export function resolveStoragePercentFromStats(
  usage: {
    storage_used?: number
    storage_quota?: number
    storage_usage_percent?: number
  } | null | undefined,
): number | undefined {
  if (!usage) return undefined
  if (
    typeof usage.storage_usage_percent === 'number' &&
    Number.isFinite(usage.storage_usage_percent)
  ) {
    return usage.storage_usage_percent
  }
  if (
    usage.storage_quota != null &&
    usage.storage_quota > 0 &&
    usage.storage_used != null
  ) {
    return (usage.storage_used / usage.storage_quota) * 100
  }
  return undefined
}

export function formatStoragePrimaryLine(
  usage: { storage_used?: number; storage_quota?: number } | null | undefined,
  loading: boolean,
): string {
  if (loading) return '—'
  if (
    !usage ||
    usage.storage_used === undefined ||
    usage.storage_quota === undefined
  ) {
    return '—'
  }
  return `${formatBytes(usage.storage_used)} / ${formatBytes(usage.storage_quota)}`
}

export function storageProgressPercent(
  usage: {
    storage_used?: number
    storage_quota?: number
    storage_usage_percent?: number
  } | null | undefined,
  loading: boolean,
): number | undefined {
  if (loading || !usage) return undefined
  return resolveStoragePercentFromStats(usage)
}

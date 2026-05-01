/** 与某位成员的对话持久化（localStorage） */

export function dialogueStorageKey(archiveId: number, memberId: number): string {
  return `mtc-dialogue-v1-${archiveId}-${memberId}`
}

/** 与后端 _dialogue_sessions 对齐的稳定 session_id */
export function stableDialogueSessionId(archiveId: number, memberId: number): string {
  return `dlg_${archiveId}_${memberId}`
}

/** 顶部导航恢复「最近一次与某成员的会话」路由（必须为 /dialogue/:archiveId/:memberId） */
const LAST_DIALOGUE_ROUTE_KEY = 'mtc-dialogue-last-route-v1'
const ROUTE_TWO_IDS = /^\/dialogue\/\d+\/\d+$/

/** 记入当前会话路由，便于顶栏返回同一聊天窗口（类微信会话列表常驻） */
export function rememberDialogueRoute(pathname: string): void {
  if (!ROUTE_TWO_IDS.test(pathname)) return
  try {
    localStorage.setItem(LAST_DIALOGUE_ROUTE_KEY, pathname)
  } catch {
    /* 配额或其它 */
  }
}

/** 导航目标：若有合法上次路由则用绝对路径打开，否则进成员选择 */
export function getResumeDialoguePath(): string {
  try {
    const p = localStorage.getItem(LAST_DIALOGUE_ROUTE_KEY)
    return p && ROUTE_TWO_IDS.test(p) ? p : '/dialogue'
  } catch {
    return '/dialogue'
  }
}

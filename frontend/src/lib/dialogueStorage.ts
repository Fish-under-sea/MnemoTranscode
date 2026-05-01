/** 与某位成员的对话持久化（localStorage） */

export function dialogueStorageKey(archiveId: number, memberId: number): string {
  return `mtc-dialogue-v1-${archiveId}-${memberId}`
}

/** 与后端 _dialogue_sessions 对齐的稳定 session_id */
export function stableDialogueSessionId(archiveId: number, memberId: number): string {
  return `dlg_${archiveId}_${memberId}`
}

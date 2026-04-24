/**
 * 记忆业务类型（时间线、Drawer、M4 分组共用）
 */
/**
 * 记忆业务类型（时间线、Drawer、卡片字段对齐）
 * archive_id 部分列表接口不返回，由页面在需要时补全。
 */
export interface Memory {
  id: number
  title: string
  content_text: string
  timestamp?: string | null
  location?: string | null
  emotion_label?: string | null
  member_id: number
  archive_id?: number
}

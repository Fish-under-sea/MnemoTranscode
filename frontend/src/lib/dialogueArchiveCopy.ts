/**
 * AI 对话选择器用词：「国家记忆」档案与关系类档案分叉（技术层仍为 member）。
 */
const PICK_LEAD = '请选择档案与对话入口：'

/** 混合列出多类档案时的统一说明（与 DIY 液态玻璃语境一致）。 */
const HINT_MIXED =
  '「国家记忆」类档案挂载「记忆实体」（非遗条目、历史人物、馆藏线索等均在此入口）；其余的恋爱、挚友类档案通常为「成员」。'

export type DialogueCopyPack = {
  /** 可数名词（成员 / 记忆实体） */
  noun: string
  loadingBundled: string
  loadingInline: string
  emptyListSuffix: string
  createArchiveCta: string
  pickerLead: string
  pickerLeadHint: string
  mobilePickTitle: string
  fallbackName: (id: number) => string
  placeholderNoSelection: string
  emptyStateSelectFirst: string
  exitChat: string
  /** 侧栏已选对象的副标题占位（relationship_type 行前） */
  metaLabelShort: string
  /** 侧栏引导问句小节标题 */
  starterSectionTitle: string
}

export function dialogueCopyPack(archiveType: string | null | undefined): DialogueCopyPack {
  const nation = String(archiveType) === 'nation'
  if (nation) {
    return {
      noun: '记忆实体',
      loadingBundled: '正在加载档案与记忆实体…',
      loadingInline: '载入记忆实体…',
      emptyListSuffix: '暂无记忆实体，',
      createArchiveCta: '前往档案库创建档案 →',
      pickerLead: PICK_LEAD,
      pickerLeadHint: HINT_MIXED,
      mobilePickTitle: '选择与入口',
      fallbackName: (id) => `实体 ${id}`,
      placeholderNoSelection: '请先在上方或左侧选择一个记忆实体',
      emptyStateSelectFirst: '请先选择左侧的记忆实体',
      exitChat: '退出当前对话',
      metaLabelShort: '模型 / 类型',
      starterSectionTitle: '试着这样问：',
    }
  }
  return {
    noun: '成员',
    loadingBundled: '正在加载档案与成员…',
    loadingInline: '载入成员…',
    emptyListSuffix: '暂无成员，',
    createArchiveCta: '前往档案库创建档案 →',
    pickerLead: PICK_LEAD,
    pickerLeadHint: HINT_MIXED,
    mobilePickTitle: '选择与入口',
    fallbackName: (id) => `成员 ${id}`,
    placeholderNoSelection: '请先在上方或左侧列表中选择成员',
    emptyStateSelectFirst: '请先选择对话成员',
    exitChat: '退出当前角色',
    metaLabelShort: '关系',
    starterSectionTitle: '试着问 Ta：',
  }
}

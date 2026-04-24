import Select from '@/components/ui/Select'
import Input from '@/components/ui/Input'
import { STATUS_OPTIONS, STATUS_META, type MemberStatus } from '@/lib/memberStatus'

export interface MemberStatusInputProps {
  status: MemberStatus
  endYear?: number
  onStatusChange: (next: MemberStatus) => void
  onEndYearChange: (next?: number) => void
}

export default function MemberStatusInput({
  status,
  endYear,
  onStatusChange,
  onEndYearChange,
}: MemberStatusInputProps) {
  const meta = STATUS_META[status]

  return (
    <div className="flex flex-col gap-3">
      <Select
        label="Ta 现在的状态"
        options={STATUS_OPTIONS}
        value={status}
        onValueChange={(v) => {
          const next = v as MemberStatus
          onStatusChange(next)
          // 切到 alive 时清空 endYear（alive 不展示）
          if (next === 'alive') onEndYearChange(undefined)
        }}
        fullWidth
      />
      {meta.showEndYear && meta.endYearLabel && (
        <Input
          type="number"
          label={meta.endYearLabel}
          value={endYear ?? ''}
          onChange={(e) => {
            const v = e.target.value
            onEndYearChange(v ? Number(v) : undefined)
          }}
          placeholder={status === 'deceased' ? '例如：2023' : '如：不清楚也没关系'}
          fullWidth
        />
      )}
    </div>
  )
}

import type { Classification } from '../../../types/domain'

const CLASSIFICATION_LABEL: Record<Classification, string> = {
  growth: '성장',
  defensive: '방어',
  cash: '현금',
}

interface ClassificationSelectProps {
  holdingId: string
  value: Classification
  disabled?: boolean
  onChange: (holdingId: string, classification: Classification) => void
}

/** 성장/방어/현금 수동 변경(FR-011) */
export function ClassificationSelect({
  holdingId,
  value,
  disabled = false,
  onChange,
}: ClassificationSelectProps) {
  return (
    <label>
      <span className="visually-hidden">분류</span>
      <select
        value={value}
        disabled={disabled}
        aria-label={`${holdingId} 분류`}
        onChange={(event) =>
          onChange(holdingId, event.target.value as Classification)
        }
      >
        {(Object.keys(CLASSIFICATION_LABEL) as Classification[]).map((classification) => (
          <option key={classification} value={classification}>
            {CLASSIFICATION_LABEL[classification]}
          </option>
        ))}
      </select>
      {disabled ? <span> 저장 중</span> : null}
    </label>
  )
}

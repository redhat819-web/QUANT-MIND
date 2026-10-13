import type { Classification, HoldingClassification } from '../../../types/domain'

const CLASSIFICATION_LABEL: Record<Classification, string> = {
  growth: '성장',
  defensive: '방어',
  cash: '현금',
}

interface ClassificationSelectProps {
  holdingId: string
  value: HoldingClassification
  disabled?: boolean
  onChange: (holdingId: string, classification: Classification) => void
}

/** 성장/방어/현금 수동 변경(FR-011). 미분류 종목은 "미분류"로 표시하되 선택지로는 주지 않는다 */
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
        {value === 'unclassified' ? (
          <option value="unclassified" disabled>
            미분류
          </option>
        ) : null}
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

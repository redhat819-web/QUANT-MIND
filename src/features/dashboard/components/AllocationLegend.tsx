import { formatWeightRatio } from '../../../lib/format'
import type { AllocationWeight, Classification } from '../../../types/domain'

const CLASSIFICATION_LABEL: Record<Classification, string> = {
  growth: '성장',
  defensive: '방어',
  cash: '현금',
}

interface AllocationLegendProps {
  allocation: AllocationWeight[]
}

/** 성장/방어/현금 비중, 색상+텍스트 병기(FR-006, 헌장 원칙 XIII) */
export function AllocationLegend({ allocation }: AllocationLegendProps) {
  return (
    <ul className="list-reset" style={{ display: 'flex', gap: 16 }}>
      {allocation.map((item) => (
        <li key={item.classification}>
          <strong>{CLASSIFICATION_LABEL[item.classification]}</strong>{' '}
          {formatWeightRatio(item.weightRatio)}
        </li>
      ))}
    </ul>
  )
}

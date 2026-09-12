import { formatKrw, formatWeightRatio } from '../../../lib/format'
import type { AllocationWeight, Classification } from '../../../types/domain'

const CLASSIFICATION_LABEL: Record<Classification, string> = {
  growth: '성장자산',
  defensive: '방어자산',
  cash: '현금성자산',
}

const CLASSIFICATION_MODIFIER: Record<Classification, string> = {
  growth: 'growth',
  defensive: 'defensive',
  cash: 'cash',
}

interface AllocationLegendProps {
  allocation: AllocationWeight[]
}

/**
 * 성장/방어/현금 비중을 가로 누적 막대로 표시(FR-006, DESIGN.quantmind.md 3.7).
 * 계열 색은 중립 회색조 + 보라 1계열만 쓰고 등락 빨강/파랑은 재사용하지 않는다.
 * 막대와 동일한 데이터를 담은 표 대안으로 범례를 함께 제공한다.
 */
export function AllocationLegend({ allocation }: AllocationLegendProps) {
  return (
    <div>
      <div className="allocation-bar">
        {allocation.map((item) => (
          <div
            key={item.classification}
            className={`allocation-bar__segment allocation-bar__segment--${CLASSIFICATION_MODIFIER[item.classification]}`}
            style={{ width: `${(item.weightRatio * 100).toFixed(2)}%` }}
          >
            {formatWeightRatio(item.weightRatio)}
          </div>
        ))}
      </div>
      <ul className="allocation-legend">
        {allocation.map((item) => (
          <li key={item.classification} className="allocation-legend__item">
            <span
              className="allocation-legend__swatch"
              style={{
                background:
                  item.classification === 'growth'
                    ? 'var(--color-accent)'
                    : item.classification === 'defensive'
                      ? 'var(--color-neutral)'
                      : 'var(--color-border)',
              }}
              aria-hidden="true"
            />
            <strong>{CLASSIFICATION_LABEL[item.classification]}</strong>
            <span className="num">
              {formatWeightRatio(item.weightRatio)} ({formatKrw(item.marketValueKrw)})
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

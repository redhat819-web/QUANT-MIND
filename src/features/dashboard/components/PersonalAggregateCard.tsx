import { formatKrw, formatReturnRate, returnRateToneClass } from '../../../lib/format'
import type { PersonalAggregate } from '../../../types/domain'

interface PersonalAggregateCardProps {
  aggregate: PersonalAggregate
  weightPercent: number
}

/** 개인 통합(계좌 → 개인 합산) 총 평가금액·수익률(FR-005). "나"/"상대방" 동등 배치용 블록 */
export function PersonalAggregateCard({
  aggregate,
  weightPercent,
}: PersonalAggregateCardProps) {
  return (
    <div className="stat-tier">
      <div className="stat-tier__head">
        <span className="stat-tier__label">{aggregate.ownerDisplayName}</span>
        <span className="stat-tier__meta">
          보유 비중 {weightPercent.toFixed(2)}%
        </span>
      </div>
      <div className="stat-tier__row">
        <span className="stat-tier__row-label">총 평가금액</span>
        <span className="stat-tier__value num">
          {formatKrw(aggregate.totalMarketValueKrw)}
        </span>
      </div>
      <div className="stat-tier__row">
        <span className="stat-tier__row-label">누적 수익률</span>
        <span className={returnRateToneClass(aggregate.weightedReturnRate)}>
          {formatReturnRate(aggregate.weightedReturnRate)}
        </span>
      </div>
    </div>
  )
}

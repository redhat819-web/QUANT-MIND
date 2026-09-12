import { formatKrw, formatReturnRate, returnRateToneClass } from '../../../lib/format'
import type { PersonalAggregate } from '../../../types/domain'

interface PersonalAggregateCardProps {
  aggregate: PersonalAggregate
}

/** 개인 통합(계좌 → 개인 합산) 총 평가금액·수익률(FR-005) */
export function PersonalAggregateCard({ aggregate }: PersonalAggregateCardProps) {
  return (
    <div className="card">
      <h3>{aggregate.ownerDisplayName}</h3>
      <p style={{ fontSize: '1.4rem', fontWeight: 700 }}>
        {formatKrw(aggregate.totalMarketValueKrw)}
      </p>
      <p className={returnRateToneClass(aggregate.weightedReturnRate)}>
        {formatReturnRate(aggregate.weightedReturnRate)}
      </p>
    </div>
  )
}

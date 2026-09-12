import { formatKrw, formatReturnRate, returnRateToneClass } from '../../../lib/format'
import type { HouseholdAggregate, PersonalAggregate } from '../../../types/domain'
import { PersonalAggregateCard } from './PersonalAggregateCard'

interface HouseholdAggregateCardProps {
  me: PersonalAggregate
  partner: PersonalAggregate
  household: HouseholdAggregate
}

/**
 * 계좌 → 개인 통합 → 부부 통합 3단계 구조를 한 번에 표시(FR-005, FR-005a).
 * 카드로 감싸지 않고 배경 위에 직접 배치하며, 부부 합계를 가장 크게,
 * "나"와 "상대방"은 동등한 크기·서식으로 나란히 배치한다(04_UIUX_PLAN.md 2.2).
 */
export function HouseholdAggregateCard({
  me,
  partner,
  household,
}: HouseholdAggregateCardProps) {
  const total = household.totalMarketValueKrw || 1
  const meWeight = (me.totalMarketValueKrw / total) * 100
  const partnerWeight = (partner.totalMarketValueKrw / total) * 100

  return (
    <div>
      <div className="stat-household">
        <div className="stat-household__head">
          <span className="stat-household__label">부부 합계 총 평가금액</span>
          <span className={returnRateToneClass(household.weightedReturnRate)}>
            {formatReturnRate(household.weightedReturnRate)}
          </span>
        </div>
        <div className="stat-household__value num">
          {formatKrw(household.totalMarketValueKrw)}
        </div>
      </div>
      <div className="stat-tier-group">
        <PersonalAggregateCard aggregate={me} weightPercent={meWeight} />
        <PersonalAggregateCard aggregate={partner} weightPercent={partnerWeight} />
      </div>
    </div>
  )
}

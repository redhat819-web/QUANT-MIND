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
 * "나: OOO원(+O%)", "상대방: OOO원(+O%)", "부부 합계: OOO원(+O%)" 형태.
 */
export function HouseholdAggregateCard({
  me,
  partner,
  household,
}: HouseholdAggregateCardProps) {
  return (
    <section className="card-grid">
      <PersonalAggregateCard aggregate={me} />
      <PersonalAggregateCard aggregate={partner} />
      <div className="card card--highlight">
        <h3>부부 합계</h3>
        <p style={{ fontSize: '1.6rem', fontWeight: 700 }}>
          {formatKrw(household.totalMarketValueKrw)}
        </p>
        <p className={returnRateToneClass(household.weightedReturnRate)}>
          {formatReturnRate(household.weightedReturnRate)}
        </p>
      </div>
    </section>
  )
}

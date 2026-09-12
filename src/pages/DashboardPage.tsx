import { DisclaimerBanner } from '../components/layout/DisclaimerBanner'
import { ErrorState } from '../components/ui/ErrorState'
import { LoadingState } from '../components/ui/LoadingState'
import { AgendaSummaryList } from '../features/dashboard/components/AgendaSummaryList'
import { AllocationLegend } from '../features/dashboard/components/AllocationLegend'
import { HouseholdAggregateCard } from '../features/dashboard/components/HouseholdAggregateCard'
import { SyncStatusBanner } from '../features/dashboard/components/SyncStatusBanner'
import { useDashboardSummary } from '../features/dashboard/hooks/useDashboardSummary'

/** User Story 1 - 통합 자산 현황과 비중 확인(FR-005~FR-008, FR-023, FR-024) */
export function DashboardPage() {
  const { data, isLoading, isError, refetch } = useDashboardSummary()

  if (isLoading) {
    return <LoadingState label="대시보드를 불러오는 중" />
  }

  if (isError || !data) {
    return <ErrorState onRetry={() => refetch()} />
  }

  return (
    <div>
      <SyncStatusBanner
        asOfSyncedAt={data.household.asOfSyncedAt}
        hasSyncFailure={data.household.hasSyncFailure}
      />
      <HouseholdAggregateCard
        me={data.me}
        partner={data.partner}
        household={data.household}
      />
      <section>
        <h2>성장 / 방어 / 현금 비중</h2>
        <AllocationLegend allocation={data.allocation} />
      </section>
      <section>
        <h2>논의 중인 안건</h2>
        <AgendaSummaryList agendas={data.discussingAgendas} />
      </section>
      <DisclaimerBanner />
    </div>
  )
}

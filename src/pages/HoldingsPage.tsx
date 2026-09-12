import { useState } from 'react'
import { DisclaimerBanner } from '../components/layout/DisclaimerBanner'
import { ErrorState } from '../components/ui/ErrorState'
import { LoadingState } from '../components/ui/LoadingState'
import { AccountSummaryTable } from '../features/holdings/components/AccountSummaryTable'
import { HoldingDetailPanel } from '../features/holdings/components/HoldingDetailPanel'
import {
  QuickModeToggle,
  type HoldingsViewMode,
} from '../features/holdings/components/QuickModeToggle'
import { useAccounts } from '../features/holdings/hooks/useAccounts'
import { useHoldingDetail } from '../features/holdings/hooks/useHoldingDetail'
import type { Classification } from '../types/domain'

/** User Story 2 - 계좌·종목 상세 조회와 분류 수정(FR-009~FR-013, FR-015, FR-023) */
export function HoldingsPage() {
  const [mode, setMode] = useState<HoldingsViewMode>('quick')
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)

  const accountsQuery = useAccounts()
  const activeAccountId =
    selectedAccountId ?? accountsQuery.data?.[0]?.accountId ?? null
  const holdingsQuery = useHoldingDetail(mode === 'detail' ? activeAccountId : null)

  if (accountsQuery.isLoading) {
    return <LoadingState label="계좌 목록을 불러오는 중" />
  }

  if (accountsQuery.isError || !accountsQuery.data) {
    return <ErrorState onRetry={() => accountsQuery.refetch()} />
  }

  function handleClassificationChange(holdingId: string, classification: Classification) {
    holdingsQuery.updateClassification.mutate({ holdingId, classification })
  }

  return (
    <div>
      <DisclaimerBanner />
      <QuickModeToggle mode={mode} onChange={setMode} />

      <section>
        <h2>계좌 요약</h2>
        <AccountSummaryTable
          accounts={accountsQuery.data}
          selectedAccountId={activeAccountId}
          onSelectAccount={setSelectedAccountId}
        />
      </section>

      {mode === 'detail' ? (
        <section>
          <h2>종목 상세</h2>
          {holdingsQuery.isLoading ? (
            <LoadingState label="종목 상세를 불러오는 중" />
          ) : holdingsQuery.isError || !holdingsQuery.data ? (
            <ErrorState onRetry={() => holdingsQuery.refetch()} />
          ) : (
            <HoldingDetailPanel
              holdings={holdingsQuery.data}
              pendingHoldingId={
                holdingsQuery.updateClassification.isPending
                  ? holdingsQuery.updateClassification.variables?.holdingId ?? null
                  : null
              }
              onClassificationChange={handleClassificationChange}
            />
          )}
        </section>
      ) : null}
    </div>
  )
}

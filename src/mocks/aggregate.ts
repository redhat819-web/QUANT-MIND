import { mockAccounts } from './fixtures/accounts'
import { mockAgendas } from './fixtures/agendas'
import { mockHoldings } from './fixtures/holdings'
import type {
  AccountSummary,
  AllocationWeight,
  Classification,
  DashboardSummary,
  PersonalAggregate,
} from '../types/domain'

/**
 * data-model.md의 personal_aggregate_view/household_aggregate_view/
 * allocation_view와 동일한 계산 규칙(평가금액 가중 평균, FR-005a)을
 * Mock 단계에서 재현한다. 실제 구현(Sheets 어댑터 단계)에서는 이 로직을
 * Supabase SQL 뷰가 대신하며, 프런트는 결과만 조회한다(research.md §1).
 */
function computePersonalAggregate(ownerUserId: string): PersonalAggregate {
  const accounts = mockAccounts.filter((a) => a.ownerUserId === ownerUserId)
  const accountIds = new Set(accounts.map((a) => a.id))
  const holdings = mockHoldings.filter((h) => accountIds.has(h.accountId))

  const totalMarketValueKrw = holdings.reduce((sum, h) => sum + h.marketValueKrw, 0)
  const weightedReturnRate =
    totalMarketValueKrw === 0
      ? 0
      : holdings.reduce((sum, h) => sum + h.marketValueKrw * h.returnRate, 0) /
        totalMarketValueKrw

  const syncedTimestamps = accounts
    .map((a) => a.lastSyncedAt)
    .filter((v): v is string => v !== null)
  const asOfSyncedAt =
    syncedTimestamps.length === 0
      ? null
      : syncedTimestamps.reduce((oldest, current) =>
          new Date(current) < new Date(oldest) ? current : oldest,
        )
  const hasSyncFailure = accounts.some((a) => a.lastSyncStatus === 'failed')

  return {
    ownerUserId,
    ownerDisplayName: accounts[0]?.ownerDisplayName ?? ownerUserId,
    totalMarketValueKrw,
    weightedReturnRate,
    asOfSyncedAt,
    hasSyncFailure,
  }
}

function computeAllocation(): AllocationWeight[] {
  const totals = new Map<Classification, number>()
  let grandTotal = 0

  for (const holding of mockHoldings) {
    totals.set(
      holding.classification,
      (totals.get(holding.classification) ?? 0) + holding.marketValueKrw,
    )
    grandTotal += holding.marketValueKrw
  }

  const classifications: Classification[] = ['growth', 'defensive', 'cash']
  return classifications.map((classification) => {
    const marketValueKrw = totals.get(classification) ?? 0
    return {
      classification,
      marketValueKrw,
      weightRatio: grandTotal === 0 ? 0 : marketValueKrw / grandTotal,
    }
  })
}

export function buildMockDashboardSummary(): DashboardSummary {
  const me = computePersonalAggregate('user-me')
  const partner = computePersonalAggregate('user-partner')

  const totalMarketValueKrw = me.totalMarketValueKrw + partner.totalMarketValueKrw
  const weightedReturnRate =
    totalMarketValueKrw === 0
      ? 0
      : (me.totalMarketValueKrw * me.weightedReturnRate +
          partner.totalMarketValueKrw * partner.weightedReturnRate) /
        totalMarketValueKrw

  const asOfCandidates = [me.asOfSyncedAt, partner.asOfSyncedAt].filter(
    (v): v is string => v !== null,
  )
  const asOfSyncedAt =
    asOfCandidates.length === 0
      ? null
      : asOfCandidates.reduce((oldest, current) =>
          new Date(current) < new Date(oldest) ? current : oldest,
        )

  return {
    me,
    partner,
    household: {
      householdId: 'household-1',
      totalMarketValueKrw,
      weightedReturnRate,
      asOfSyncedAt,
      hasSyncFailure: me.hasSyncFailure || partner.hasSyncFailure,
    },
    allocation: computeAllocation(),
    discussingAgendas: mockAgendas
      .filter((a) => a.status === 'discussing')
      .map(({ id, title, status }) => ({ id, title, status })),
  }
}

/**
 * 계좌별 빠른 확인 모드 요약(계좌명, 합계 평가금액, 대표 손익률)을
 * mockHoldings 최신 상태(분류 변경과 무관, 금액/손익률 자체는 불변)로 계산한다
 * (FR-009, data-model.md holding).
 */
export function buildMockAccountSummaries(): AccountSummary[] {
  return mockAccounts.map((account) => {
    const holdings = mockHoldings.filter((h) => h.accountId === account.id)
    const totalMarketValueKrw = holdings.reduce((sum, h) => sum + h.marketValueKrw, 0)
    const representativeReturnRate =
      totalMarketValueKrw === 0
        ? 0
        : holdings.reduce((sum, h) => sum + h.marketValueKrw * h.returnRate, 0) /
          totalMarketValueKrw

    return {
      accountId: account.id,
      accountName: account.accountName,
      ownerDisplayName: account.ownerDisplayName,
      totalMarketValueKrw,
      representativeReturnRate,
      lastSyncedAt: account.lastSyncedAt,
      lastSyncStatus: account.lastSyncStatus,
      lastSyncError: account.lastSyncError,
    }
  })
}

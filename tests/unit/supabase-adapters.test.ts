import { describe, expect, it } from 'vitest'
import {
  buildDashboardSummary,
  type DashboardRows,
} from '../../src/features/dashboard/api/supabaseDashboard'
import {
  buildAccountSummaries,
  toHolding,
  type AccountRow,
} from '../../src/features/holdings/api/supabaseHoldings'

const ME = 'uid-me'
const PARTNER = 'uid-partner'
const HH = 'hh-1'

function dashboardRows(overrides: Partial<DashboardRows> = {}): DashboardRows {
  return {
    members: [
      { user_id: ME, household_id: HH },
      { user_id: PARTNER, household_id: HH },
    ],
    personal: [
      {
        household_id: HH,
        owner_type: 'member',
        owner_user_id: PARTNER,
        owner_label: null,
        total_market_value_krw: '2000',
        weighted_return_rate: '0.1',
        as_of_synced_at: '2026-10-09T06:14:09+00:00',
        has_sync_failure: true,
      },
      {
        household_id: HH,
        owner_type: 'member',
        owner_user_id: ME,
        owner_label: null,
        total_market_value_krw: 1000,
        weighted_return_rate: -0.05,
        as_of_synced_at: '2026-10-09T06:14:09+00:00',
        has_sync_failure: false,
      },
      {
        household_id: HH,
        owner_type: 'child',
        owner_user_id: null,
        owner_label: '자녀',
        total_market_value_krw: 500,
        weighted_return_rate: 0.2,
        as_of_synced_at: null,
        has_sync_failure: false,
      },
    ],
    household: [
      {
        household_id: HH,
        total_market_value_krw: 3000,
        weighted_return_rate: 0.05,
        as_of_synced_at: '2026-10-09T06:14:09+00:00',
        has_sync_failure: true,
      },
    ],
    allocation: [
      {
        household_id: HH,
        classification: 'cash',
        classification_market_value_krw: 300,
        weight_ratio: 0.1,
      },
      {
        household_id: HH,
        classification: 'growth',
        classification_market_value_krw: 2100,
        weight_ratio: 0.7,
      },
      {
        household_id: HH,
        classification: 'defensive',
        classification_market_value_krw: 600,
        weight_ratio: 0.2,
      },
    ],
    discussingAgendas: [],
    ...overrides,
  }
}

describe('buildDashboardSummary', () => {
  it('로그인 사용자를 나, 다른 구성원을 상대방으로 두고 자녀 행은 넣지 않는다', () => {
    const summary = buildDashboardSummary(dashboardRows(), ME)
    expect(summary.me).toMatchObject({
      ownerUserId: ME,
      ownerDisplayName: '나',
      totalMarketValueKrw: 1000,
      weightedReturnRate: -0.05,
    })
    expect(summary.partner).toMatchObject({
      ownerUserId: PARTNER,
      ownerDisplayName: '상대방',
      totalMarketValueKrw: 2000,
      weightedReturnRate: 0.1,
      hasSyncFailure: true,
    })
    expect(summary.household).toMatchObject({
      householdId: HH,
      totalMarketValueKrw: 3000,
      hasSyncFailure: true,
    })
  })

  it('비중은 성장/방어/현금 순서로 두고 미분류는 있을 때만 붙인다', () => {
    const without = buildDashboardSummary(dashboardRows(), ME)
    expect(without.allocation.map((a) => a.classification)).toEqual([
      'growth',
      'defensive',
      'cash',
    ])

    const withUnclassified = buildDashboardSummary(
      dashboardRows({
        allocation: [
          ...dashboardRows().allocation,
          {
            household_id: HH,
            classification: 'unclassified',
            classification_market_value_krw: 10,
            weight_ratio: 0.01,
          },
        ],
      }),
      ME,
    )
    expect(withUnclassified.allocation.map((a) => a.classification)).toEqual([
      'growth',
      'defensive',
      'cash',
      'unclassified',
    ])
  })

  it('상대방 데이터가 없으면 0원으로 둔다', () => {
    const summary = buildDashboardSummary(
      dashboardRows({ members: [{ user_id: ME, household_id: HH }] }),
      ME,
    )
    expect(summary.partner).toMatchObject({
      totalMarketValueKrw: 0,
      asOfSyncedAt: null,
      hasSyncFailure: false,
    })
  })

  it('household 구성원이 아니면 오류를 낸다', () => {
    expect(() => buildDashboardSummary(dashboardRows(), 'uid-stranger')).toThrow()
  })
})

function account(overrides: Partial<AccountRow>): AccountRow {
  return {
    id: 'acc',
    account_name: '계좌',
    owner_type: 'member',
    owner_user_id: ME,
    owner_label: null,
    last_synced_at: null,
    last_sync_status: 'success',
    last_sync_error: null,
    holding: [],
    ...overrides,
  }
}

describe('buildAccountSummaries', () => {
  it('매입원가 기준으로 손익률을 계산하고 원가 없는 종목은 손익률에서만 뺀다', () => {
    const [summary] = buildAccountSummaries(
      [
        account({
          holding: [
            { market_value_krw: '1100', cost_krw: '1000' },
            { market_value_krw: 500, cost_krw: null },
          ],
        }),
      ],
      ME,
    )
    expect(summary.totalMarketValueKrw).toBe(1600)
    expect(summary.representativeReturnRate).toBeCloseTo(0.1)
  })

  it('나 → 상대방 → 자녀 순서로 정렬하고 소유자 이름을 붙인다', () => {
    const summaries = buildAccountSummaries(
      [
        account({
          id: 'c',
          owner_type: 'child',
          owner_user_id: null,
          owner_label: '첫째',
        }),
        account({ id: 'p', owner_user_id: PARTNER }),
        account({ id: 'm', owner_user_id: ME }),
      ],
      ME,
    )
    expect(summaries.map((s) => [s.accountId, s.ownerDisplayName])).toEqual([
      ['m', '나'],
      ['p', '상대방'],
      ['c', '첫째'],
    ])
  })

  it('종목이 없거나 원가 합계가 0이면 손익률 0', () => {
    const [summary] = buildAccountSummaries([account({})], ME)
    expect(summary).toMatchObject({ totalMarketValueKrw: 0, representativeReturnRate: 0 })
  })
})

describe('toHolding', () => {
  it('numeric 문자열을 숫자로 바꾸고 조건부 항목 null은 그대로 둔다', () => {
    const holding = toHolding({
      id: 'h',
      account_id: 'acc',
      display_name: '종목',
      quantity: '3',
      market_value_krw: '1500',
      return_rate: '0.12',
      classification: 'unclassified',
      ticker: null,
      currency: null,
      average_cost: null,
      dividend: null,
      is_mapped: false,
      raw_label: '종목',
    })
    expect(holding).toMatchObject({
      quantity: 3,
      marketValueKrw: 1500,
      returnRate: 0.12,
      averageCost: null,
      dividend: null,
      classification: 'unclassified',
    })
  })
})

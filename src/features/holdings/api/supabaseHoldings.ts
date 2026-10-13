import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AccountSummary,
  Holding,
  HoldingClassification,
  SyncStatus,
} from '../../../types/domain'

/** account 한 행 + 그 계좌 holding의 금액 컬럼(임베드 조회) */
export interface AccountRow {
  id: string
  account_name: string
  owner_type: 'member' | 'joint' | 'child'
  owner_user_id: string | null
  owner_label: string | null
  last_synced_at: string | null
  last_sync_status: SyncStatus | null
  last_sync_error: string | null
  holding: { market_value_krw: number | string; cost_krw: number | string | null }[]
}

export interface HoldingRow {
  id: string
  account_id: string
  display_name: string
  quantity: number | string
  market_value_krw: number | string
  return_rate: number | string
  classification: HoldingClassification
  ticker: string | null
  currency: string | null
  average_cost: number | string | null
  dividend: number | string | null
  is_mapped: boolean
  raw_label: string
}

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function toNullableNumber(value: number | string | null | undefined): number | null {
  return value === null || value === undefined ? null : toNumber(value)
}

function ownerDisplayName(row: AccountRow, myUserId: string): string {
  if (row.owner_type === 'child') return row.owner_label ?? '자녀'
  if (row.owner_type === 'joint') return '공동'
  return row.owner_user_id === myUserId ? '나' : '상대방'
}

/**
 * 계좌 요약(FR-009). 대표 손익률은 뷰와 같은 규칙 — (Σ평가금액 − Σ매입원가) ÷
 * Σ매입원가, 매입원가 없는 종목은 분자·분모에서 제외(owner_type 마이그레이션 C7).
 * 계좌 순서: 나 → 상대방 → 공동 → 자녀, 같은 소유자 안에서는 계좌명 순.
 */
export function buildAccountSummaries(
  rows: AccountRow[],
  myUserId: string,
): AccountSummary[] {
  const ownerRank = (row: AccountRow) =>
    row.owner_type === 'member'
      ? row.owner_user_id === myUserId
        ? 0
        : 1
      : row.owner_type === 'joint'
        ? 2
        : 3

  return [...rows]
    .sort(
      (a, b) =>
        ownerRank(a) - ownerRank(b) || a.account_name.localeCompare(b.account_name, 'ko'),
    )
    .map((row) => {
      const total = row.holding.reduce((sum, h) => sum + toNumber(h.market_value_krw), 0)
      const withCost = row.holding.filter((h) => h.cost_krw !== null)
      const costSum = withCost.reduce((sum, h) => sum + toNumber(h.cost_krw), 0)
      const valueWithCost = withCost.reduce(
        (sum, h) => sum + toNumber(h.market_value_krw),
        0,
      )
      return {
        accountId: row.id,
        accountName: row.account_name,
        ownerDisplayName: ownerDisplayName(row, myUserId),
        totalMarketValueKrw: total,
        representativeReturnRate: costSum === 0 ? 0 : (valueWithCost - costSum) / costSum,
        lastSyncedAt: row.last_synced_at,
        lastSyncStatus: row.last_sync_status,
        lastSyncError: row.last_sync_error,
      }
    })
}

export function toHolding(row: HoldingRow): Holding {
  return {
    id: row.id,
    accountId: row.account_id,
    displayName: row.display_name,
    quantity: toNumber(row.quantity),
    marketValueKrw: toNumber(row.market_value_krw),
    returnRate: toNumber(row.return_rate),
    classification: row.classification,
    ticker: row.ticker,
    currency: row.currency,
    averageCost: toNullableNumber(row.average_cost),
    dividend: toNullableNumber(row.dividend),
    isMapped: row.is_mapped,
    rawLabel: row.raw_label,
  }
}

export async function fetchAccountSummariesFromSupabase(
  supabase: SupabaseClient,
  myUserId: string,
): Promise<AccountSummary[]> {
  const { data, error } = await supabase
    .from('account')
    .select(
      'id, account_name, owner_type, owner_user_id, owner_label, last_synced_at, last_sync_status, last_sync_error, holding(market_value_krw, cost_krw)',
    )
  if (error) {
    throw new Error('계좌 목록을 불러오지 못했습니다.')
  }
  return buildAccountSummaries(data as AccountRow[], myUserId)
}

export async function fetchHoldingsFromSupabase(
  supabase: SupabaseClient,
  accountId: string,
): Promise<Holding[]> {
  const { data, error } = await supabase
    .from('holding')
    .select(
      'id, account_id, display_name, quantity, market_value_krw, return_rate, classification, ticker, currency, average_cost, dividend, is_mapped, raw_label',
    )
    .eq('account_id', accountId)
    .order('market_value_krw', { ascending: false })
  if (error) {
    throw new Error('종목 상세를 불러오지 못했습니다.')
  }
  return (data as HoldingRow[]).map(toHolding)
}

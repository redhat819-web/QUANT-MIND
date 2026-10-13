import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Agenda,
  AllocationWeight,
  DashboardSummary,
  HoldingClassification,
  PersonalAggregate,
} from '../../../types/domain'

/** personal_aggregate_view 한 행(개인 단위, child 포함) */
export interface PersonalAggregateRow {
  household_id: string
  owner_type: 'member' | 'joint' | 'child'
  owner_user_id: string | null
  owner_label: string | null
  total_market_value_krw: number | string | null
  weighted_return_rate: number | string | null
  as_of_synced_at: string | null
  has_sync_failure: boolean | null
}

/** household_aggregate_view 한 행(child 제외, joint 포함) */
export interface HouseholdAggregateRow {
  household_id: string
  total_market_value_krw: number | string | null
  weighted_return_rate: number | string | null
  as_of_synced_at: string | null
  has_sync_failure: boolean | null
}

/** allocation_view 한 행(child 제외) */
export interface AllocationRow {
  household_id: string
  classification: HoldingClassification
  classification_market_value_krw: number | string | null
  weight_ratio: number | string | null
}

export interface MemberRow {
  user_id: string
  household_id: string
}

export interface DashboardRows {
  members: MemberRow[]
  personal: PersonalAggregateRow[]
  household: HouseholdAggregateRow[]
  allocation: AllocationRow[]
  discussingAgendas: Pick<Agenda, 'id' | 'title' | 'status'>[]
}

/** PostgREST는 numeric을 숫자로 주지만 정밀도 설정에 따라 문자열일 수 있어 둘 다 받는다 */
function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

const ALLOCATION_ORDER: HoldingClassification[] = [
  'growth',
  'defensive',
  'cash',
  'unclassified',
]

function personalFor(
  rows: PersonalAggregateRow[],
  ownerUserId: string,
  displayName: string,
): PersonalAggregate {
  const row = rows.find(
    (r) => r.owner_type === 'member' && r.owner_user_id === ownerUserId,
  )
  return {
    ownerUserId,
    ownerDisplayName: displayName,
    totalMarketValueKrw: toNumber(row?.total_market_value_krw),
    weightedReturnRate: toNumber(row?.weighted_return_rate),
    asOfSyncedAt: row?.as_of_synced_at ?? null,
    hasSyncFailure: row?.has_sync_failure ?? false,
  }
}

/**
 * 뷰 결과 → DashboardSummary. 나/상대방은 로그인 사용자 기준으로 정한다(DB에는
 * member만 저장, owner_type 마이그레이션 참고). 자녀(child) 행은 나/상대방에 넣지
 * 않는다 — 부부 합계(household_aggregate_view)도 child를 제외한다.
 * 미분류(unclassified) 비중은 0보다 클 때만 남긴다.
 */
export function buildDashboardSummary(
  rows: DashboardRows,
  myUserId: string,
): DashboardSummary {
  const me = rows.members.find((m) => m.user_id === myUserId)
  if (!me) {
    throw new Error('household 구성원이 아닙니다.')
  }
  const partnerMember = rows.members.find((m) => m.user_id !== myUserId)
  const household = rows.household.find((h) => h.household_id === me.household_id)

  const allocation: AllocationWeight[] = ALLOCATION_ORDER.flatMap((classification) => {
    const row = rows.allocation.find((a) => a.classification === classification)
    if (classification === 'unclassified' && !row) return []
    return [
      {
        classification,
        marketValueKrw: toNumber(row?.classification_market_value_krw),
        weightRatio: toNumber(row?.weight_ratio),
      },
    ]
  })

  return {
    me: personalFor(rows.personal, myUserId, '나'),
    partner: partnerMember
      ? personalFor(rows.personal, partnerMember.user_id, '상대방')
      : personalFor([], '', '상대방'),
    household: {
      householdId: me.household_id,
      totalMarketValueKrw: toNumber(household?.total_market_value_krw),
      weightedReturnRate: toNumber(household?.weighted_return_rate),
      asOfSyncedAt: household?.as_of_synced_at ?? null,
      hasSyncFailure: household?.has_sync_failure ?? false,
    },
    allocation,
    discussingAgendas: rows.discussingAgendas,
  }
}

export async function fetchDashboardSummaryFromSupabase(
  supabase: SupabaseClient,
  myUserId: string,
): Promise<DashboardSummary> {
  const [members, personal, household, allocation, agendas] = await Promise.all([
    supabase.from('household_members').select('user_id, household_id'),
    supabase.from('personal_aggregate_view').select('*'),
    supabase.from('household_aggregate_view').select('*'),
    supabase.from('allocation_view').select('*'),
    supabase
      .from('agenda')
      .select('id, title, status')
      .eq('status', 'discussing')
      .order('created_at', { ascending: false }),
  ])
  const failed = [members, personal, household, allocation, agendas].find((r) => r.error)
  if (failed) {
    throw new Error('대시보드 데이터를 불러오지 못했습니다.')
  }
  return buildDashboardSummary(
    {
      members: members.data as MemberRow[],
      personal: personal.data as PersonalAggregateRow[],
      household: household.data as HouseholdAggregateRow[],
      allocation: allocation.data as AllocationRow[],
      discussingAgendas: agendas.data as DashboardRows['discussingAgendas'],
    },
    myUserId,
  )
}

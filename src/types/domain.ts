export type Classification = 'growth' | 'defensive' | 'cash'

export type SyncStatus = 'success' | 'failed'

export interface Account {
  id: string
  householdId: string
  ownerUserId: string
  ownerDisplayName: string
  accountName: string
  lastSyncedAt: string | null
  lastSyncStatus: SyncStatus | null
  lastSyncError: string | null
}

export interface Holding {
  id: string
  accountId: string
  displayName: string
  quantity: number
  marketValueKrw: number
  returnRate: number
  classification: Classification
  ticker: string | null
  currency: string | null
  averageCost: number | null
  dividend: number | null
  isMapped: boolean
  rawLabel: string
}

/** 계좌 → 개인 통합(personal_aggregate_view) 단계 */
export interface PersonalAggregate {
  ownerUserId: string
  ownerDisplayName: string
  totalMarketValueKrw: number
  weightedReturnRate: number
  asOfSyncedAt: string | null
  hasSyncFailure: boolean
}

/** 개인 통합 → 부부 통합(household_aggregate_view) 단계 */
export interface HouseholdAggregate {
  householdId: string
  totalMarketValueKrw: number
  weightedReturnRate: number
  asOfSyncedAt: string | null
  hasSyncFailure: boolean
}

export interface AllocationWeight {
  classification: Classification
  marketValueKrw: number
  weightRatio: number
}

export type AgendaStatus = 'discussing' | 'agreed'

export interface Agenda {
  id: string
  householdId: string
  authorUserId: string
  authorDisplayName: string
  title: string
  body: string
  status: AgendaStatus
  createdAt: string
  updatedAt: string
}

export interface Opinion {
  id: string
  agendaId: string
  authorUserId: string
  authorDisplayName: string
  body: string
  createdAt: string
}

export interface AgreementRecord {
  id: string
  agendaId: string
  confirmedByUserId: string
  confirmedByDisplayName: string
  confirmedAt: string
  opinionCountAtConfirmation: number
}

/** 계좌·종목 리스트(User Story 2) 빠른 확인 모드 뷰 모델 */
export interface AccountSummary {
  accountId: string
  accountName: string
  ownerDisplayName: string
  totalMarketValueKrw: number
  representativeReturnRate: number
  lastSyncedAt: string | null
  lastSyncStatus: SyncStatus | null
  lastSyncError: string | null
}

/** 판단 로그(User Story 3) 안건 상세 화면이 한 번에 필요로 하는 뷰 모델 */
export interface AgendaDetail {
  agenda: Agenda
  opinions: Opinion[]
  agreementRecord: AgreementRecord | null
}

/** 대시보드(User Story 1)가 한 번에 필요로 하는 뷰 모델 */
export interface DashboardSummary {
  me: PersonalAggregate
  partner: PersonalAggregate
  household: HouseholdAggregate
  allocation: AllocationWeight[]
  discussingAgendas: Pick<Agenda, 'id' | 'title' | 'status'>[]
}

import type { Account } from '../../types/domain'

/**
 * Stitch 목업(SCR-001/SCR-002)에 등장한 계좌 4개를 그대로 예시 데이터로 사용한다.
 * 토스뱅크 파킹통장은 동기화 실패 케이스(FR-024 "일부 계좌 동기화 실패" 배지)를
 * 재현하도록 last_sync_status='failed'로 둔다.
 */
export const mockAccounts: Account[] = [
  {
    id: 'acc-me-1',
    householdId: 'household-1',
    ownerUserId: 'user-me',
    ownerDisplayName: '나',
    accountName: 'KB증권 종합위탁',
    lastSyncedAt: '2026-09-12T19:00:00+09:00',
    lastSyncStatus: 'success',
    lastSyncError: null,
  },
  {
    id: 'acc-me-2',
    householdId: 'household-1',
    ownerUserId: 'user-me',
    ownerDisplayName: '나',
    accountName: '신한투자증권 연금저축',
    lastSyncedAt: '2026-09-12T19:00:00+09:00',
    lastSyncStatus: 'success',
    lastSyncError: null,
  },
  {
    id: 'acc-partner-1',
    householdId: 'household-1',
    ownerUserId: 'user-partner',
    ownerDisplayName: '상대방',
    accountName: '미래에셋 해외주식',
    lastSyncedAt: '2026-09-12T18:45:00+09:00',
    lastSyncStatus: 'success',
    lastSyncError: null,
  },
  {
    id: 'acc-partner-2',
    householdId: 'household-1',
    ownerUserId: 'user-partner',
    ownerDisplayName: '상대방',
    accountName: '토스뱅크 파킹통장',
    lastSyncedAt: '2026-09-11T19:00:00+09:00',
    lastSyncStatus: 'failed',
    lastSyncError: "시트 '파킹통장' 열 형식이 예상과 달라 자동 인식 실패",
  },
]

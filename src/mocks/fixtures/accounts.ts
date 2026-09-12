import type { Account } from '../../types/domain'

/**
 * 정상 케이스 + 동기화 실패 케이스(계좌3)를 포함해 SyncStatusBanner의
 * has_sync_failure 배지(FR-024)를 mock 단계에서도 검증할 수 있게 한다.
 */
export const mockAccounts: Account[] = [
  {
    id: 'acc-me-1',
    householdId: 'household-1',
    ownerUserId: 'user-me',
    ownerDisplayName: '나',
    accountName: '나의 증권계좌 A',
    lastSyncedAt: '2026-09-05T19:00:00+09:00',
    lastSyncStatus: 'success',
    lastSyncError: null,
  },
  {
    id: 'acc-me-2',
    householdId: 'household-1',
    ownerUserId: 'user-me',
    ownerDisplayName: '나',
    accountName: '나의 연금계좌',
    lastSyncedAt: '2026-09-05T19:00:00+09:00',
    lastSyncStatus: 'success',
    lastSyncError: null,
  },
  {
    id: 'acc-partner-1',
    householdId: 'household-1',
    ownerUserId: 'user-partner',
    ownerDisplayName: '상대방',
    accountName: '상대방 증권계좌 A',
    lastSyncedAt: '2026-09-04T19:00:00+09:00',
    lastSyncStatus: 'failed',
    lastSyncError: "시트 '계좌1' D12 셀 값이 숫자가 아님",
  },
]

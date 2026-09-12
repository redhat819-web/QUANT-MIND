import { useQuery } from '@tanstack/react-query'
import type { AccountSummary } from '../../../types/domain'

async function fetchAccountsSummary(): Promise<AccountSummary[]> {
  const response = await fetch('/mock-api/accounts-summary')
  if (!response.ok) {
    throw new Error('계좌 목록을 불러오지 못했습니다.')
  }
  return response.json()
}

/**
 * 계좌별 빠른 확인 모드(FR-009)용 Mock 어댑터. Sheets 어댑터(U5) 단계에서
 * 내부 구현만 personal 단위 뷰 조회로 교체하고 반환 타입은 유지한다.
 */
export function useAccounts() {
  return useQuery({
    queryKey: ['accounts-summary'],
    queryFn: fetchAccountsSummary,
  })
}

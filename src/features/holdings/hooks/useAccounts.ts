import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../../app/providers/AuthProvider'
import { useDataSource } from '../../../app/providers/DataSourceProvider'
import { getSupabase } from '../../../lib/supabase'
import type { AccountSummary } from '../../../types/domain'
import { fetchAccountSummariesFromSupabase } from '../api/supabaseHoldings'

async function fetchAccountsSummary(): Promise<AccountSummary[]> {
  const response = await fetch('/mock-api/accounts-summary')
  if (!response.ok) {
    throw new Error('계좌 목록을 불러오지 못했습니다.')
  }
  return response.json()
}

/**
 * 계좌별 빠른 확인 모드(FR-009). mock 모드는 MSW, supabase 모드는 account +
 * holding 금액 컬럼을 조회해 계좌별로 합산한다(T055).
 */
export function useAccounts() {
  const dataSource = useDataSource()
  const { user } = useAuth()
  const userId = user?.id ?? null

  return useQuery({
    queryKey: ['accounts-summary', dataSource, userId],
    queryFn: () =>
      dataSource === 'supabase'
        ? fetchAccountSummariesFromSupabase(getSupabase(), userId as string)
        : fetchAccountsSummary(),
    enabled: dataSource === 'mock' || userId !== null,
  })
}

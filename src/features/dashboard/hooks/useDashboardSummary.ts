import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../../app/providers/AuthProvider'
import { useDataSource } from '../../../app/providers/DataSourceProvider'
import { getSupabase } from '../../../lib/supabase'
import type { DashboardSummary } from '../../../types/domain'
import { fetchDashboardSummaryFromSupabase } from '../api/supabaseDashboard'

async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const response = await fetch('/mock-api/dashboard-summary')
  if (!response.ok) {
    throw new Error('대시보드 데이터를 불러오지 못했습니다.')
  }
  return response.json()
}

/**
 * mock 모드는 MSW, supabase 모드는 personal_aggregate_view/household_aggregate_view/
 * allocation_view를 조회한다(T055). 반환 타입(DashboardSummary)은 두 모드가 같다.
 */
export function useDashboardSummary() {
  const dataSource = useDataSource()
  const { user } = useAuth()
  const userId = user?.id ?? null

  return useQuery({
    queryKey: ['dashboard-summary', dataSource, userId],
    queryFn: () =>
      dataSource === 'supabase'
        ? fetchDashboardSummaryFromSupabase(getSupabase(), userId as string)
        : fetchDashboardSummary(),
    enabled: dataSource === 'mock' || userId !== null,
  })
}

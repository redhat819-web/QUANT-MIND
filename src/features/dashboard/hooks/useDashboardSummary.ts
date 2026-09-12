import { useQuery } from '@tanstack/react-query'
import type { DashboardSummary } from '../../../types/domain'

async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const response = await fetch('/mock-api/dashboard-summary')
  if (!response.ok) {
    throw new Error('대시보드 데이터를 불러오지 못했습니다.')
  }
  return response.json()
}

/**
 * Mock 어댑터. Sheets 어댑터(U5) 단계에서 이 훅의 내부 구현만
 * personal_aggregate_view/household_aggregate_view/allocation_view를 조회하는
 * supabase-js 호출로 교체하고, 반환 타입(DashboardSummary)은 그대로 유지한다.
 */
export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: fetchDashboardSummary,
  })
}

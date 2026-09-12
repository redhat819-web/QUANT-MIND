import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Classification, Holding } from '../../../types/domain'

async function fetchHoldings(accountId: string): Promise<Holding[]> {
  const response = await fetch(
    `/mock-api/holdings?accountId=${encodeURIComponent(accountId)}`,
  )
  if (!response.ok) {
    throw new Error('종목 상세를 불러오지 못했습니다.')
  }
  return response.json()
}

async function patchClassification(
  holdingId: string,
  classification: Classification,
): Promise<Holding> {
  const response = await fetch(
    `/mock-api/holdings/${encodeURIComponent(holdingId)}/classification`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classification }),
    },
  )
  if (!response.ok) {
    throw new Error('분류 변경에 실패했습니다.')
  }
  return response.json()
}

/**
 * 계좌별 종목 상세 모드(FR-010)와 분류 수동 변경(FR-011)을 담당하는 Mock
 * 어댑터. 분류 변경 시 이 훅의 캐시뿐 아니라 대시보드 비중(dashboard-summary)
 * 쿼리도 무효화해, 대시보드로 돌아갔을 때 비중이 즉시 반영되게 한다
 * (US2 연동 지점: HoldingsPage → DashboardPage 비중 재계산).
 */
export function useHoldingDetail(accountId: string | null) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['holdings', accountId],
    queryFn: () => fetchHoldings(accountId as string),
    enabled: accountId !== null,
  })

  const updateClassification = useMutation({
    mutationFn: ({
      holdingId,
      classification,
    }: {
      holdingId: string
      classification: Classification
    }) => patchClassification(holdingId, classification),
    onSuccess: (updated) => {
      queryClient.setQueryData<Holding[]>(['holdings', accountId], (old) =>
        old?.map((h) => (h.id === updated.id ? updated : h)) ?? old,
      )
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      queryClient.invalidateQueries({ queryKey: ['accounts-summary'] })
    },
  })

  return { ...query, updateClassification }
}

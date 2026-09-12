import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Agenda } from '../../../types/domain'

async function fetchAgendas(): Promise<Agenda[]> {
  const response = await fetch('/mock-api/agendas')
  if (!response.ok) {
    throw new Error('안건 목록을 불러오지 못했습니다.')
  }
  return response.json()
}

async function postAgenda(input: {
  title: string
  body: string
  authorUserId: string
  authorDisplayName: string
}): Promise<Agenda> {
  const response = await fetch('/mock-api/agendas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    throw new Error('안건 작성에 실패했습니다.')
  }
  return response.json()
}

/**
 * 안건 목록 조회/작성(FR-016, FR-018) Mock 어댑터. Supabase 협업 기능(U4)
 * 단계에서 내부 구현만 agenda 테이블 CRUD로 교체하고 반환 타입은 유지한다.
 */
export function useAgendas() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['agendas'],
    queryFn: fetchAgendas,
  })

  const createAgenda = useMutation({
    mutationFn: postAgenda,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendas'] })
    },
  })

  return { ...query, createAgenda }
}

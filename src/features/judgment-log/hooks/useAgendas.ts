import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../../app/providers/AuthProvider'
import { useDataSource } from '../../../app/providers/DataSourceProvider'
import { getSupabase } from '../../../lib/supabase'
import type { Agenda } from '../../../types/domain'
import { createAgendaInSupabase, fetchAgendasFromSupabase } from '../api/supabaseAgendas'

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
 * 안건 목록 조회/작성(FR-016, FR-018). mock 모드는 MSW, supabase 모드는 agenda
 * 테이블을 쓴다(T061). 반환 타입은 두 모드가 같다.
 */
export function useAgendas() {
  const queryClient = useQueryClient()
  const dataSource = useDataSource()
  const { user } = useAuth()
  const userId = user?.id ?? null

  const query = useQuery({
    queryKey: ['agendas', dataSource, userId],
    queryFn: () =>
      dataSource === 'supabase'
        ? fetchAgendasFromSupabase(getSupabase(), userId as string)
        : fetchAgendas(),
    enabled: dataSource === 'mock' || userId !== null,
  })

  const createAgenda = useMutation({
    mutationFn: (input: Parameters<typeof postAgenda>[0]) =>
      dataSource === 'supabase' ? createAgendaInSupabase(getSupabase(), input) : postAgenda(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendas'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
    },
  })

  return { ...query, createAgenda }
}

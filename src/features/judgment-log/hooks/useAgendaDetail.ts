import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AgendaDetail, AgreementRecord, Opinion } from '../../../types/domain'

async function fetchAgendaDetail(agendaId: string): Promise<AgendaDetail> {
  const response = await fetch(`/mock-api/agendas/${encodeURIComponent(agendaId)}`)
  if (!response.ok) {
    throw new Error('안건 상세를 불러오지 못했습니다.')
  }
  return response.json()
}

async function patchAgenda(
  agendaId: string,
  input: { title: string; body: string; requestedByUserId: string },
) {
  const response = await fetch(`/mock-api/agendas/${encodeURIComponent(agendaId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    throw new Error('안건 수정에 실패했습니다.')
  }
  return response.json()
}

async function postOpinion(
  agendaId: string,
  input: { body: string; authorUserId: string; authorDisplayName: string },
): Promise<Opinion> {
  const response = await fetch(
    `/mock-api/agendas/${encodeURIComponent(agendaId)}/opinions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
  if (!response.ok) {
    throw new Error('의견 작성에 실패했습니다.')
  }
  return response.json()
}

async function postAgreement(
  agendaId: string,
  input: { confirmedByUserId: string; confirmedByDisplayName: string },
): Promise<AgreementRecord> {
  const response = await fetch(
    `/mock-api/agendas/${encodeURIComponent(agendaId)}/agreement`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
  if (!response.ok) {
    throw new Error('합의 확정에 실패했습니다.')
  }
  return response.json()
}

/**
 * 안건 상세(의견 목록 + 합의 기록) 조회와 의견 작성(FR-017)/작성자 전용
 * 수정(FR-016a)/합의 확정(FR-019)을 담당하는 Mock 어댑터.
 */
export function useAgendaDetail(agendaId: string | null) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['agenda-detail', agendaId],
    queryFn: () => fetchAgendaDetail(agendaId as string),
    enabled: agendaId !== null,
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['agenda-detail', agendaId] })
    queryClient.invalidateQueries({ queryKey: ['agendas'] })
  }

  const updateAgenda = useMutation({
    mutationFn: (input: { title: string; body: string; requestedByUserId: string }) =>
      patchAgenda(agendaId as string, input),
    onSuccess: invalidate,
  })

  const addOpinion = useMutation({
    mutationFn: (input: { body: string; authorUserId: string; authorDisplayName: string }) =>
      postOpinion(agendaId as string, input),
    onSuccess: invalidate,
  })

  const confirmAgreement = useMutation({
    mutationFn: (input: { confirmedByUserId: string; confirmedByDisplayName: string }) =>
      postAgreement(agendaId as string, input),
    onSuccess: invalidate,
  })

  return { ...query, updateAgenda, addOpinion, confirmAgreement }
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useAuth } from '../../../app/providers/AuthProvider'
import { useDataSource } from '../../../app/providers/DataSourceProvider'
import { getSupabase } from '../../../lib/supabase'
import type { AgendaDetail, AgreementRecord, Opinion } from '../../../types/domain'
import {
  addOpinionInSupabase,
  confirmAgreementInSupabase,
  fetchAgendaDetailFromSupabase,
  updateAgendaInSupabase,
} from '../api/supabaseAgendas'

/** 합의완료 안건은 reason이 있어야 저장된다(FR-021) */
export interface UpdateAgendaInput {
  title: string
  body: string
  requestedByUserId: string
  requestedByDisplayName: string
  reason?: string
}

async function fetchAgendaDetail(agendaId: string): Promise<AgendaDetail> {
  const response = await fetch(`/mock-api/agendas/${encodeURIComponent(agendaId)}`)
  if (!response.ok) {
    throw new Error('안건 상세를 불러오지 못했습니다.')
  }
  return response.json()
}

async function patchAgenda(
  agendaId: string,
  input: UpdateAgendaInput,
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
 * 안건 상세(의견 + 합의 기록 + 변경 이력) 조회와 의견 작성(FR-017), 수정(논의중은
 * 작성자 본인 FR-016a, 합의완료는 사유와 함께 FR-021), 합의 확정(FR-019).
 * mock 모드는 MSW, supabase 모드는 agenda/opinion/agreement_record/agenda_history를
 * 쓴다(T061). 반환 타입은 두 모드가 같다.
 */
export function useAgendaDetail(agendaId: string | null) {
  const queryClient = useQueryClient()
  const dataSource = useDataSource()
  const { user } = useAuth()
  const userId = user?.id ?? ''

  const query = useQuery({
    queryKey: ['agenda-detail', agendaId],
    queryFn: () =>
      dataSource === 'supabase'
        ? fetchAgendaDetailFromSupabase(getSupabase(), agendaId as string, userId)
        : fetchAgendaDetail(agendaId as string),
    enabled: agendaId !== null,
  })

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['agenda-detail', agendaId] })
    queryClient.invalidateQueries({ queryKey: ['agendas'] })
    // 대시보드의 "논의 중인 안건" 요약도 상태·제목 변경을 따라가야 한다
    queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
  }

  const updateAgenda = useMutation({
    mutationFn: async (input: UpdateAgendaInput) => {
      if (dataSource === 'supabase') {
        await updateAgendaInSupabase(getSupabase(), agendaId as string, input)
        return
      }
      await patchAgenda(agendaId as string, input)
    },
    onSuccess: invalidate,
  })

  const addOpinion = useMutation({
    mutationFn: async (input: { body: string; authorUserId: string; authorDisplayName: string }) => {
      if (dataSource === 'supabase') {
        await addOpinionInSupabase(getSupabase(), agendaId as string, input)
        return
      }
      await postOpinion(agendaId as string, input)
    },
    onSuccess: invalidate,
  })

  const confirmAgreement = useMutation({
    mutationFn: async (input: { confirmedByUserId: string; confirmedByDisplayName: string }) => {
      if (dataSource === 'supabase') {
        await confirmAgreementInSupabase(getSupabase(), agendaId as string, input)
        return
      }
      await postAgreement(agendaId as string, input)
    },
    onSuccess: invalidate,
  })

  // 저장 실패 상태는 선택한 안건에만 속한다 — 안건이 바뀌면 지운다
  const { reset: resetUpdate } = updateAgenda
  const { reset: resetOpinion } = addOpinion
  const { reset: resetConfirm } = confirmAgreement
  useEffect(() => {
    resetUpdate()
    resetOpinion()
    resetConfirm()
  }, [agendaId, resetUpdate, resetOpinion, resetConfirm])

  return { ...query, updateAgenda, addOpinion, confirmAgreement }
}

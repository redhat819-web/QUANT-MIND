import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type {
  Agenda,
  AgendaDetail,
  AgendaHistoryEntry,
  AgendaStatus,
  AgreementRecord,
  Opinion,
} from '../../../types/domain'

/** 작성자 이름은 household_members.display_name을 임베드해 가져온다(FR-022) */
type MemberEmbed = { display_name: string | null } | null

export interface AgendaRow {
  id: string
  household_id: string
  author_user_id: string
  title: string
  body: string
  status: AgendaStatus
  created_at: string
  updated_at: string
  author: MemberEmbed
}

export interface OpinionRow {
  id: string
  agenda_id: string
  author_user_id: string
  body: string
  created_at: string
  author: MemberEmbed
}

export interface AgreementRow {
  id: string
  agenda_id: string
  confirmed_by_user_id: string
  confirmed_at: string
  opinion_count_at_confirmation: number
  confirmer: MemberEmbed
}

export interface HistoryRow {
  id: string
  agenda_id: string
  changed_by_user_id: string
  changed_at: string
  reason: string
  previous_title: string | null
  previous_body: string | null
  changer: MemberEmbed
}

const AGENDA_COLUMNS =
  'id, household_id, author_user_id, title, body, status, created_at, updated_at, author:household_members(display_name)'
const OPINION_COLUMNS =
  'id, agenda_id, author_user_id, body, created_at, author:household_members(display_name)'
const AGREEMENT_COLUMNS =
  'id, agenda_id, confirmed_by_user_id, confirmed_at, opinion_count_at_confirmation, confirmer:household_members(display_name)'
const HISTORY_COLUMNS =
  'id, agenda_id, changed_by_user_id, changed_at, reason, previous_title, previous_body, changer:household_members(display_name)'

/** display_name이 비어 있으면 계좌 화면과 같은 규칙으로 나/상대방을 쓴다 */
export function memberName(embed: MemberEmbed, userId: string, myUserId: string): string {
  const name = embed?.display_name?.trim()
  if (name) return name
  return userId === myUserId ? '나' : '상대방'
}

export function toAgenda(row: AgendaRow, myUserId: string): Agenda {
  return {
    id: row.id,
    householdId: row.household_id,
    authorUserId: row.author_user_id,
    authorDisplayName: memberName(row.author, row.author_user_id, myUserId),
    title: row.title,
    body: row.body,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toOpinion(row: OpinionRow, myUserId: string): Opinion {
  return {
    id: row.id,
    agendaId: row.agenda_id,
    authorUserId: row.author_user_id,
    authorDisplayName: memberName(row.author, row.author_user_id, myUserId),
    body: row.body,
    createdAt: row.created_at,
  }
}

export function toAgreementRecord(row: AgreementRow, myUserId: string): AgreementRecord {
  return {
    id: row.id,
    agendaId: row.agenda_id,
    confirmedByUserId: row.confirmed_by_user_id,
    confirmedByDisplayName: memberName(row.confirmer, row.confirmed_by_user_id, myUserId),
    confirmedAt: row.confirmed_at,
    opinionCountAtConfirmation: row.opinion_count_at_confirmation,
  }
}

export function toHistoryEntry(row: HistoryRow, myUserId: string): AgendaHistoryEntry {
  return {
    id: row.id,
    agendaId: row.agenda_id,
    changedByUserId: row.changed_by_user_id,
    changedByDisplayName: memberName(row.changer, row.changed_by_user_id, myUserId),
    changedAt: row.changed_at,
    reason: row.reason,
    previousTitle: row.previous_title,
    previousBody: row.previous_body,
  }
}

/**
 * DB 오류를 사용자 문구로 바꾼다. 기술 용어(RLS, 코드 번호)는 노출하지 않는다
 * (DESIGN.quantmind.md). 23505(unique)·42501(RLS)는 합의 중복/권한 없음이다.
 */
export function toUserMessage(error: PostgrestError | null, fallback: string): string {
  if (!error) return fallback
  if (error.code === '23505') return '이미 합의가 확정된 안건입니다. 새로고침 후 확인해주세요.'
  if (error.code === '42501' || error.code === 'PGRST116' || error.code === 'P0002') {
    return '이 안건을 수정할 권한이 없거나 안건 상태가 바뀌었습니다. 새로고침 후 확인해주세요.'
  }
  if (error.code === '22023' || error.code === 'P0001') return '수정 사유를 1~500자로 입력해주세요.'
  return fallback
}

export async function fetchAgendasFromSupabase(
  supabase: SupabaseClient,
  myUserId: string,
): Promise<Agenda[]> {
  const { data, error } = await supabase
    .from('agenda')
    .select(AGENDA_COLUMNS)
    .order('created_at', { ascending: false })
  if (error) throw new Error('안건 목록을 불러오지 못했습니다.')
  return (data as unknown as AgendaRow[]).map((row) => toAgenda(row, myUserId))
}

export async function fetchAgendaDetailFromSupabase(
  supabase: SupabaseClient,
  agendaId: string,
  myUserId: string,
): Promise<AgendaDetail> {
  const [agenda, opinions, agreement, history] = await Promise.all([
    supabase.from('agenda').select(AGENDA_COLUMNS).eq('id', agendaId).single(),
    supabase
      .from('opinion')
      .select(OPINION_COLUMNS)
      .eq('agenda_id', agendaId)
      .order('created_at', { ascending: true }),
    supabase.from('agreement_record').select(AGREEMENT_COLUMNS).eq('agenda_id', agendaId).maybeSingle(),
    supabase
      .from('agenda_history')
      .select(HISTORY_COLUMNS)
      .eq('agenda_id', agendaId)
      .order('changed_at', { ascending: false }),
  ])
  if (agenda.error || opinions.error || agreement.error || history.error) {
    throw new Error('안건 상세를 불러오지 못했습니다.')
  }
  return {
    agenda: toAgenda(agenda.data as unknown as AgendaRow, myUserId),
    opinions: (opinions.data as unknown as OpinionRow[]).map((row) => toOpinion(row, myUserId)),
    agreementRecord: agreement.data
      ? toAgreementRecord(agreement.data as unknown as AgreementRow, myUserId)
      : null,
    history: (history.data as unknown as HistoryRow[]).map((row) => toHistoryEntry(row, myUserId)),
  }
}

export async function createAgendaInSupabase(
  supabase: SupabaseClient,
  input: { title: string; body: string; authorUserId: string },
): Promise<Agenda> {
  const member = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', input.authorUserId)
    .single()
  if (member.error) throw new Error(toUserMessage(member.error, '안건 작성에 실패했습니다.'))

  const { data, error } = await supabase
    .from('agenda')
    .insert({
      household_id: (member.data as { household_id: string }).household_id,
      author_user_id: input.authorUserId,
      title: input.title,
      body: input.body,
    })
    .select(AGENDA_COLUMNS)
    .single()
  if (error) throw new Error(toUserMessage(error, '안건 작성에 실패했습니다.'))
  return toAgenda(data as unknown as AgendaRow, input.authorUserId)
}

/**
 * 논의중 안건은 작성자 본인만 직접 UPDATE(FR-016a, RLS agenda_update),
 * 합의완료 안건은 사유와 함께 edit_agreed_agenda RPC로 수정한다(FR-021).
 */
export async function updateAgendaInSupabase(
  supabase: SupabaseClient,
  agendaId: string,
  input: { title: string; body: string; requestedByUserId: string; reason?: string },
): Promise<void> {
  if (input.reason !== undefined) {
    const { error } = await supabase.rpc('edit_agreed_agenda', {
      p_agenda_id: agendaId,
      p_title: input.title,
      p_body: input.body,
      p_reason: input.reason,
    })
    if (error) throw new Error(toUserMessage(error, '안건 수정에 실패했습니다.'))
    return
  }
  const { error } = await supabase
    .from('agenda')
    .update({ title: input.title, body: input.body })
    .eq('id', agendaId)
    .eq('status', 'discussing')
    .select('id')
    .single()
  if (error) throw new Error(toUserMessage(error, '안건 수정에 실패했습니다.'))
}

export async function addOpinionInSupabase(
  supabase: SupabaseClient,
  agendaId: string,
  input: { body: string; authorUserId: string },
): Promise<void> {
  const { error } = await supabase
    .from('opinion')
    .insert({ agenda_id: agendaId, author_user_id: input.authorUserId, body: input.body })
  if (error) throw new Error(toUserMessage(error, '의견 작성에 실패했습니다.'))
}

/** 확정 시점 의견 수와 안건 상태 전환은 DB 트리거가 맡는다(FR-019) */
export async function confirmAgreementInSupabase(
  supabase: SupabaseClient,
  agendaId: string,
  input: { confirmedByUserId: string },
): Promise<void> {
  const { error } = await supabase
    .from('agreement_record')
    .insert({ agenda_id: agendaId, confirmed_by_user_id: input.confirmedByUserId })
  if (error) throw new Error(toUserMessage(error, '합의 확정에 실패했습니다.'))
}

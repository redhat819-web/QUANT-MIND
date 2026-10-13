import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'

/**
 * T064: 실제 Supabase에 대해 판단 로그 규칙을 검증한다(FR-016a, FR-019, FR-021).
 * `npm run test:integration`으로만 실행되며, 아래 환경변수가 없으면 건너뛴다.
 *   QM_IT_SUPABASE_URL, QM_IT_SUPABASE_ANON_KEY
 *   QM_IT_MEMBER_A_EMAIL, QM_IT_MEMBER_A_PASSWORD  (같은 household의 구성원 A)
 *   QM_IT_MEMBER_B_EMAIL, QM_IT_MEMBER_B_PASSWORD  (같은 household의 구성원 B)
 * 주의: agenda에는 삭제 정책이 없어 테스트가 만든 안건은 지워지지 않는다. 제목에
 * "[통합테스트]"가 붙으므로 실제 household가 아닌 테스트 household 계정을 쓴다.
 */
const env = process.env
const url = env.QM_IT_SUPABASE_URL
const anonKey = env.QM_IT_SUPABASE_ANON_KEY
const configured = Boolean(
  url &&
    anonKey &&
    env.QM_IT_MEMBER_A_EMAIL &&
    env.QM_IT_MEMBER_A_PASSWORD &&
    env.QM_IT_MEMBER_B_EMAIL &&
    env.QM_IT_MEMBER_B_PASSWORD,
)

async function signedIn(email: string, password: string) {
  const client = createClient(url as string, anonKey as string, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error || !data.user) throw new Error(`로그인 실패: ${email}`)
  return { client, userId: data.user.id }
}

describe.skipIf(!configured)('판단 로그 DB 규칙 (T064)', () => {
  let a: { client: SupabaseClient; userId: string }
  let b: { client: SupabaseClient; userId: string }
  let agendaId: string
  const originalTitle = `[통합테스트] 원래 제목 ${new Date().toISOString()}`

  beforeAll(async () => {
    a = await signedIn(env.QM_IT_MEMBER_A_EMAIL as string, env.QM_IT_MEMBER_A_PASSWORD as string)
    b = await signedIn(env.QM_IT_MEMBER_B_EMAIL as string, env.QM_IT_MEMBER_B_PASSWORD as string)

    const member = await a.client
      .from('household_members')
      .select('household_id')
      .eq('user_id', a.userId)
      .single()
    expect(member.error).toBeNull()

    const created = await a.client
      .from('agenda')
      .insert({
        household_id: (member.data as { household_id: string }).household_id,
        author_user_id: a.userId,
        title: originalTitle,
        body: '원래 내용',
      })
      .select('id, status')
      .single()
    expect(created.error).toBeNull()
    expect(created.data?.status).toBe('discussing')
    agendaId = (created.data as { id: string }).id
  })

  it('논의중 안건은 작성자가 아닌 구성원이 수정할 수 없다(FR-016a)', async () => {
    const { data } = await b.client
      .from('agenda')
      .update({ title: '남이 바꾼 제목' })
      .eq('id', agendaId)
      .select('id')
    expect(data ?? []).toHaveLength(0)
  })

  it('합의 확정 시 의견 수는 클라이언트 값이 아니라 DB가 센다(FR-019)', async () => {
    const opinion = await b.client
      .from('opinion')
      .insert({ agenda_id: agendaId, author_user_id: b.userId, body: '통합테스트 의견' })
    expect(opinion.error).toBeNull()

    const confirmed = await b.client
      .from('agreement_record')
      .insert({ agenda_id: agendaId, confirmed_by_user_id: b.userId, opinion_count_at_confirmation: 99 })
      .select('opinion_count_at_confirmation')
      .single()
    expect(confirmed.error).toBeNull()
    expect(confirmed.data?.opinion_count_at_confirmation).toBe(1)

    const agenda = await a.client.from('agenda').select('status').eq('id', agendaId).single()
    expect(agenda.data?.status).toBe('agreed')
  })

  it('이미 합의된 안건은 다시 확정할 수 없다', async () => {
    const again = await a.client
      .from('agreement_record')
      .insert({ agenda_id: agendaId, confirmed_by_user_id: a.userId })
    expect(again.error).not.toBeNull()
  })

  it('합의완료 안건을 사유 없이 직접 수정하면 거부된다(FR-021)', async () => {
    const direct = await a.client
      .from('agenda')
      .update({ title: '사유 없는 수정' })
      .eq('id', agendaId)
      .select('id')
    expect(direct.error).not.toBeNull()
  })

  it('상태 컬럼은 클라이언트가 바꿀 수 없다', async () => {
    const statusChange = await a.client
      .from('agenda')
      .update({ status: 'discussing' })
      .eq('id', agendaId)
    expect(statusChange.error).not.toBeNull()
  })

  it('사유와 함께 수정하면 원본이 이력으로 남는다(FR-021, 다른 구성원도 가능)', async () => {
    const edited = await b.client.rpc('edit_agreed_agenda', {
      p_agenda_id: agendaId,
      p_title: '[통합테스트] 바뀐 제목',
      p_body: '바뀐 내용',
      p_reason: '통합테스트 사유',
    })
    expect(edited.error).toBeNull()

    const history = await a.client
      .from('agenda_history')
      .select('changed_by_user_id, reason, previous_title, previous_body')
      .eq('agenda_id', agendaId)
    expect(history.error).toBeNull()
    expect(history.data).toEqual([
      {
        changed_by_user_id: b.userId,
        reason: '통합테스트 사유',
        previous_title: originalTitle,
        previous_body: '원래 내용',
      },
    ])
  })

  it('비로그인(anon) 요청은 안건을 읽을 수 없다(FR-002)', async () => {
    const anon = createClient(url as string, anonKey as string, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await anon.from('agenda').select('id').eq('id', agendaId)
    expect(error !== null || (data ?? []).length === 0).toBe(true)
  })
})

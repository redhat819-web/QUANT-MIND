import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import {
  confirmAgreementInSupabase,
  memberName,
  toAgenda,
  toUserMessage,
  updateAgendaInSupabase,
  type AgendaRow,
} from '../../src/features/judgment-log/api/supabaseAgendas'

/** from(...).update/insert/select/eq/single 체인과 rpc 호출을 순서대로 기록하는 가짜 클라이언트 */
function fakeClient(result: { error: unknown } = { error: null }) {
  const calls: { method: string; args: unknown[] }[] = []
  const chain: Record<string, unknown> = {}
  for (const method of ['from', 'update', 'insert', 'select', 'eq', 'single']) {
    chain[method] = vi.fn((...args: unknown[]) => {
      calls.push({ method, args })
      return chain
    })
  }
  // await하면 결과를 돌려준다(PostgrestBuilder처럼 thenable)
  chain.then = (resolve: (value: unknown) => void) => resolve({ data: null, ...result })
  const rpc = vi.fn(async (...args: unknown[]) => {
    calls.push({ method: 'rpc', args })
    return { data: null, ...result }
  })
  return { client: { ...chain, rpc } as unknown as SupabaseClient, calls }
}

describe('supabaseAgendas', () => {
  it('display_name이 없으면 로그인 사용자 기준으로 나/상대방을 쓴다', () => {
    expect(memberName({ display_name: '현진' }, 'u1', 'u1')).toBe('현진')
    expect(memberName({ display_name: '  ' }, 'u1', 'u1')).toBe('나')
    expect(memberName(null, 'u2', 'u1')).toBe('상대방')
  })

  it('agenda 행을 도메인 타입으로 바꾼다', () => {
    const row: AgendaRow = {
      id: 'a1',
      household_id: 'h1',
      author_user_id: 'u2',
      title: '제목',
      body: '내용',
      status: 'agreed',
      created_at: '2026-10-10T00:00:00Z',
      updated_at: '2026-10-10T01:00:00Z',
      author: { display_name: null },
    }
    expect(toAgenda(row, 'u1')).toEqual({
      id: 'a1',
      householdId: 'h1',
      authorUserId: 'u2',
      authorDisplayName: '상대방',
      title: '제목',
      body: '내용',
      status: 'agreed',
      createdAt: '2026-10-10T00:00:00Z',
      updatedAt: '2026-10-10T01:00:00Z',
    })
  })

  it('DB 오류 코드를 기술 용어 없는 문구로 바꾼다', () => {
    const err = (code: string) => ({ code, message: '', details: '', hint: '' }) as never
    expect(toUserMessage(err('23505'), 'x')).toContain('이미 합의가 확정된')
    expect(toUserMessage(err('42501'), 'x')).toContain('권한이 없거나')
    expect(toUserMessage(err('22023'), 'x')).toContain('수정 사유')
    expect(toUserMessage(err('XX000'), '기본 문구')).toBe('기본 문구')
  })

  it('합의완료 안건(사유 있음)은 edit_agreed_agenda RPC로 수정한다', async () => {
    const { client, calls } = fakeClient()
    await updateAgendaInSupabase(client, 'a1', {
      title: 't',
      body: 'b',
      reason: '정정',
      requestedByUserId: 'u1',
    })
    expect(calls).toEqual([
      {
        method: 'rpc',
        args: ['edit_agreed_agenda', { p_agenda_id: 'a1', p_title: 't', p_body: 'b', p_reason: '정정' }],
      },
    ])
  })

  it('논의중 안건(사유 없음)은 논의중 조건을 걸고 직접 UPDATE한다', async () => {
    const { client, calls } = fakeClient()
    await updateAgendaInSupabase(client, 'a1', { title: 't', body: 'b', requestedByUserId: 'u1' })
    expect(calls.map((c) => c.method)).toEqual(['from', 'update', 'eq', 'eq', 'select', 'single'])
    expect(calls[1].args).toEqual([{ title: 't', body: 'b' }])
    expect(calls[3].args).toEqual(['status', 'discussing'])
  })

  it('합의 확정은 의견 수를 보내지 않는다(DB 트리거가 센다)', async () => {
    const { client, calls } = fakeClient()
    await confirmAgreementInSupabase(client, 'a1', { confirmedByUserId: 'u1' })
    expect(calls[1]).toEqual({
      method: 'insert',
      args: [{ agenda_id: 'a1', confirmed_by_user_id: 'u1' }],
    })
  })

  it('저장 실패는 사용자 문구로 던진다', async () => {
    const { client } = fakeClient({ error: { code: '23505' } })
    await expect(
      confirmAgreementInSupabase(client, 'a1', { confirmedByUserId: 'u1' }),
    ).rejects.toThrow('이미 합의가 확정된 안건입니다')
  })
})

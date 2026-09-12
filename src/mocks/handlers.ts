import { http, HttpResponse } from 'msw'
import { buildMockAccountSummaries, buildMockDashboardSummary } from './aggregate'
import { mockAgendas } from './fixtures/agendas'
import { mockAgreementRecords } from './fixtures/agreements'
import { mockHoldings } from './fixtures/holdings'
import { mockOpinions } from './fixtures/opinions'
import type { Agenda, AgendaDetail, Classification } from '../types/domain'

let nextAgendaId = mockAgendas.length + 1
let nextOpinionId = mockOpinions.length + 1
let nextAgreementId = mockAgreementRecords.length + 1

function findAgendaDetail(agendaId: string): AgendaDetail | null {
  const agenda = mockAgendas.find((a) => a.id === agendaId)
  if (!agenda) return null
  return {
    agenda,
    opinions: mockOpinions.filter((o) => o.agendaId === agendaId),
    agreementRecord: mockAgreementRecords.find((r) => r.agendaId === agendaId) ?? null,
  }
}

/**
 * Mock 모드에서 훅이 실제 네트워크 호출 형태(fetch)로 데이터를 가져오도록
 * 인터셉트한다. 나중에 Supabase 어댑터로 교체될 때도 훅의 인터페이스는
 * 동일하게 유지된다(research.md §4, plan.md DataSourceProvider).
 */
export const handlers = [
  http.get('/mock-api/dashboard-summary', () => {
    return HttpResponse.json(buildMockDashboardSummary())
  }),

  http.get('/mock-api/accounts-summary', () => {
    return HttpResponse.json(buildMockAccountSummaries())
  }),

  http.get('/mock-api/holdings', ({ request }) => {
    const url = new URL(request.url)
    const accountId = url.searchParams.get('accountId')
    const holdings = accountId
      ? mockHoldings.filter((h) => h.accountId === accountId)
      : mockHoldings
    return HttpResponse.json(holdings)
  }),

  http.patch('/mock-api/holdings/:id/classification', async ({ params, request }) => {
    const body = (await request.json()) as { classification: Classification }
    const holding = mockHoldings.find((h) => h.id === params.id)
    if (!holding) {
      return HttpResponse.json({ message: '종목을 찾을 수 없습니다.' }, { status: 404 })
    }
    holding.classification = body.classification
    return HttpResponse.json(holding)
  }),

  http.get('/mock-api/agendas', () => {
    return HttpResponse.json(mockAgendas)
  }),

  http.get('/mock-api/agendas/:id', ({ params }) => {
    const detail = findAgendaDetail(params.id as string)
    if (!detail) {
      return HttpResponse.json({ message: '안건을 찾을 수 없습니다.' }, { status: 404 })
    }
    return HttpResponse.json(detail)
  }),

  http.post('/mock-api/agendas', async ({ request }) => {
    const body = (await request.json()) as {
      title: string
      body: string
      authorUserId: string
      authorDisplayName: string
    }
    const now = new Date().toISOString()
    const agenda: Agenda = {
      id: `agenda-${nextAgendaId++}`,
      householdId: 'household-1',
      authorUserId: body.authorUserId,
      authorDisplayName: body.authorDisplayName,
      title: body.title,
      body: body.body,
      status: 'discussing',
      createdAt: now,
      updatedAt: now,
    }
    mockAgendas.unshift(agenda)
    return HttpResponse.json(agenda, { status: 201 })
  }),

  http.patch('/mock-api/agendas/:id', async ({ params, request }) => {
    const body = (await request.json()) as {
      title: string
      body: string
      requestedByUserId: string
    }
    const agenda = mockAgendas.find((a) => a.id === params.id)
    if (!agenda) {
      return HttpResponse.json({ message: '안건을 찾을 수 없습니다.' }, { status: 404 })
    }
    if (agenda.status !== 'discussing' || agenda.authorUserId !== body.requestedByUserId) {
      return HttpResponse.json(
        { message: '논의중 상태의 작성자 본인만 수정할 수 있습니다.' },
        { status: 403 },
      )
    }
    agenda.title = body.title
    agenda.body = body.body
    agenda.updatedAt = new Date().toISOString()
    return HttpResponse.json(agenda)
  }),

  http.post('/mock-api/agendas/:id/opinions', async ({ params, request }) => {
    const agendaId = params.id as string
    if (!mockAgendas.some((a) => a.id === agendaId)) {
      return HttpResponse.json({ message: '안건을 찾을 수 없습니다.' }, { status: 404 })
    }
    const body = (await request.json()) as {
      body: string
      authorUserId: string
      authorDisplayName: string
    }
    const opinion = {
      id: `opinion-${nextOpinionId++}`,
      agendaId,
      authorUserId: body.authorUserId,
      authorDisplayName: body.authorDisplayName,
      body: body.body,
      createdAt: new Date().toISOString(),
    }
    mockOpinions.push(opinion)
    return HttpResponse.json(opinion, { status: 201 })
  }),

  http.post('/mock-api/agendas/:id/agreement', async ({ params, request }) => {
    const agendaId = params.id as string
    const agenda = mockAgendas.find((a) => a.id === agendaId)
    if (!agenda) {
      return HttpResponse.json({ message: '안건을 찾을 수 없습니다.' }, { status: 404 })
    }
    const body = (await request.json()) as {
      confirmedByUserId: string
      confirmedByDisplayName: string
    }
    const opinionCountAtConfirmation = mockOpinions.filter(
      (o) => o.agendaId === agendaId,
    ).length
    const record = {
      id: `agreement-${nextAgreementId++}`,
      agendaId,
      confirmedByUserId: body.confirmedByUserId,
      confirmedByDisplayName: body.confirmedByDisplayName,
      confirmedAt: new Date().toISOString(),
      opinionCountAtConfirmation,
    }
    mockAgreementRecords.push(record)
    agenda.status = 'agreed'
    agenda.updatedAt = record.confirmedAt
    return HttpResponse.json(record, { status: 201 })
  }),
]

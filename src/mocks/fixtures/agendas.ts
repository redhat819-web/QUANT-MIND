import type { Agenda } from '../../types/domain'

/**
 * 논의중 안건 2건(작성자가 나/상대방 각각인 케이스, FR-016a 검증용)과
 * 의견 0건 상태로 합의완료된 안건 1건(FR-019, Clarifications Q3)을 포함한다.
 */
export const mockAgendas: Agenda[] = [
  {
    id: 'agenda-1',
    householdId: 'household-1',
    authorUserId: 'user-me',
    authorDisplayName: '나',
    title: '해외 ETF 비중을 더 늘릴지 논의',
    body: '최근 환율과 금리를 고려했을 때 해외 ETF 비중을 5%p 정도 늘리는 방안을 검토해보면 어떨까?',
    status: 'discussing',
    createdAt: '2026-09-04T21:10:00+09:00',
    updatedAt: '2026-09-04T21:10:00+09:00',
  },
  {
    id: 'agenda-2',
    householdId: 'household-1',
    authorUserId: 'user-partner',
    authorDisplayName: '상대방',
    title: '연금계좌 추가 납입 시점 논의',
    body: '연말정산 세액공제 한도를 고려해 연금계좌 추가 납입을 이번 달에 할지 다음 달로 미룰지 정하자.',
    status: 'discussing',
    createdAt: '2026-09-03T20:05:00+09:00',
    updatedAt: '2026-09-03T20:05:00+09:00',
  },
  {
    id: 'agenda-3',
    householdId: 'household-1',
    authorUserId: 'user-me',
    authorDisplayName: '나',
    title: '비상금 계좌 분리 여부',
    body: '생활비 계좌와 비상금 계좌를 분리해서 관리하는 방안, 별다른 이견 없어 그대로 확정.',
    status: 'agreed',
    createdAt: '2026-08-20T19:30:00+09:00',
    updatedAt: '2026-08-21T09:00:00+09:00',
  },
]

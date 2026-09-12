import type { Opinion } from '../../types/domain'

/** agenda-1(Stitch SCR-003 상세 예시)은 의견 2건, 나머지는 의견 0건(FR-019 케이스 포함) */
export const mockOpinions: Opinion[] = [
  {
    id: 'opinion-1',
    agendaId: 'agenda-1',
    authorUserId: 'user-partner',
    authorDisplayName: '상대방',
    body: '배당 ETF 배분 방향에는 동의합니다. 다만 연말 양도소득세 한도(연 250만원)와 ISA 계좌 납입 한도 잔여분을 활용할 수 있는지 먼저 확인하고 매수 시점을 분할하는 것이 좋겠습니다.',
    createdAt: '2026-09-11T19:30:00+09:00',
  },
  {
    id: 'opinion-2',
    agendaId: 'agenda-1',
    authorUserId: 'user-me',
    authorDisplayName: '나',
    body: '좋은 의견입니다. ISA 계좌 잔여 납입한도 1,000만원 먼저 채우고, 나머지는 일반 위탁계좌에서 3회 분할 매수하는 것으로 세부 계획 수정하겠습니다.',
    createdAt: '2026-09-12T10:15:00+09:00',
  },
]

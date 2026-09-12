import type { Opinion } from '../../types/domain'

/** agenda-1은 의견 2건, agenda-2/agenda-3은 의견 0건(FR-019 케이스 포함) */
export const mockOpinions: Opinion[] = [
  {
    id: 'opinion-1',
    agendaId: 'agenda-1',
    authorUserId: 'user-partner',
    authorDisplayName: '상대방',
    body: '환율이 부담되긴 하지만 장기 관점에서는 나쁘지 않은 것 같아. 3%p 정도로 시작해볼까?',
    createdAt: '2026-09-04T22:00:00+09:00',
  },
  {
    id: 'opinion-2',
    agendaId: 'agenda-1',
    authorUserId: 'user-me',
    authorDisplayName: '나',
    body: '좋아, 우선 3%p로 시작하고 다음 분기에 다시 논의하자.',
    createdAt: '2026-09-04T22:30:00+09:00',
  },
]

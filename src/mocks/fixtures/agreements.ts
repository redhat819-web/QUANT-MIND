import type { AgreementRecord } from '../../types/domain'

/** agenda-5는 의견 0건 상태에서 합의 확정된 케이스(FR-019, Clarifications Q3) */
export const mockAgreementRecords: AgreementRecord[] = [
  {
    id: 'agreement-1',
    agendaId: 'agenda-5',
    confirmedByUserId: 'user-me',
    confirmedByDisplayName: '나',
    confirmedAt: '2026-06-28T18:00:00+09:00',
    opinionCountAtConfirmation: 0,
  },
  {
    id: 'agreement-2',
    agendaId: 'agenda-6',
    confirmedByUserId: 'user-partner',
    confirmedByDisplayName: '상대방',
    confirmedAt: '2026-05-14T21:00:00+09:00',
    opinionCountAtConfirmation: 0,
  },
]

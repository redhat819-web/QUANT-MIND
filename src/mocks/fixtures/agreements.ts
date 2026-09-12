import type { AgreementRecord } from '../../types/domain'

/** agenda-3은 의견 0건 상태에서 합의 확정된 케이스(FR-019, Clarifications Q3) */
export const mockAgreementRecords: AgreementRecord[] = [
  {
    id: 'agreement-1',
    agendaId: 'agenda-3',
    confirmedByUserId: 'user-me',
    confirmedByDisplayName: '나',
    confirmedAt: '2026-08-21T09:00:00+09:00',
    opinionCountAtConfirmation: 0,
  },
]

import { formatDateTime } from '../../../lib/format'
import { EmptyState } from '../../../components/ui/EmptyState'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import type { Agenda } from '../../../types/domain'

interface AgendaListProps {
  agendas: Agenda[]
  selectedAgendaId: string | null
  onSelectAgenda: (agendaId: string) => void
}

/** 논의중/합의완료 StatusBadge, 작성자·작성 시각 함께 표시(FR-018, FR-022) */
export function AgendaList({ agendas, selectedAgendaId, onSelectAgenda }: AgendaListProps) {
  if (agendas.length === 0) {
    return <EmptyState message="아직 등록된 안건이 없습니다." />
  }

  return (
    <ul className="agenda-list list-reset">
      {agendas.map((agenda) => (
        <li key={agenda.id}>
          <button
            type="button"
            className="agenda-list-item"
            aria-pressed={agenda.id === selectedAgendaId}
            onClick={() => onSelectAgenda(agenda.id)}
          >
            <div className="agenda-list-item__head">
              {agenda.status === 'discussing' ? (
                <StatusBadge label="논의중" tone="warning" />
              ) : (
                <StatusBadge label="합의완료" tone="neutral" />
              )}
              <span className="num" style={{ fontSize: '0.75rem' }}>
                {formatDateTime(agenda.createdAt)}
              </span>
            </div>
            <p className="agenda-list-item__title">{agenda.title}</p>
            <div className="agenda-list-item__meta">
              <span>작성자: {agenda.authorDisplayName}</span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}

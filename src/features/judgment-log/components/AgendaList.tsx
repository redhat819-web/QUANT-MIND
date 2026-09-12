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
    <ul className="list-reset">
      {agendas.map((agenda) => (
        <li
          key={agenda.id}
          className="card"
          style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
        >
          <button
            type="button"
            aria-pressed={agenda.id === selectedAgendaId}
            onClick={() => onSelectAgenda(agenda.id)}
          >
            {agenda.title}
          </button>
          {agenda.status === 'discussing' ? (
            <StatusBadge label="논의중" tone="warning" />
          ) : (
            <StatusBadge label="합의완료" tone="success" />
          )}
          <div>
            <span>{agenda.authorDisplayName}</span>{' '}
            <span>{formatDateTime(agenda.createdAt)}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}

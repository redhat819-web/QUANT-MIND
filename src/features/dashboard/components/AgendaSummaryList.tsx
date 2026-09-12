import { EmptyState } from '../../../components/ui/EmptyState'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import type { Agenda } from '../../../types/domain'

interface AgendaSummaryListProps {
  agendas: Pick<Agenda, 'id' | 'title' | 'status'>[]
}

/** 논의 중인 안건 요약 3~5행(FR-007) */
export function AgendaSummaryList({ agendas }: AgendaSummaryListProps) {
  if (agendas.length === 0) {
    return <EmptyState message="논의 중인 안건이 없습니다." />
  }

  return (
    <ul className="agenda-summary-list">
      {agendas.map((agenda) => (
        <li key={agenda.id} className="agenda-summary-row">
          <span className="agenda-summary-row__title">{agenda.title}</span>
          <StatusBadge label="논의중" tone="warning" />
        </li>
      ))}
    </ul>
  )
}

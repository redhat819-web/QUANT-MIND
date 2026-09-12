import { useState } from 'react'
import { useAuth } from '../app/providers/AuthProvider'
import { DisclaimerBanner } from '../components/layout/DisclaimerBanner'
import { ErrorState } from '../components/ui/ErrorState'
import { LoadingState } from '../components/ui/LoadingState'
import { StatusBadge } from '../components/ui/StatusBadge'
import { AgendaForm } from '../features/judgment-log/components/AgendaForm'
import { AgendaList } from '../features/judgment-log/components/AgendaList'
import { AgreementConfirmButton } from '../features/judgment-log/components/AgreementConfirmButton'
import { OpinionThread } from '../features/judgment-log/components/OpinionThread'
import { useAgendaDetail } from '../features/judgment-log/hooks/useAgendaDetail'
import { useAgendas } from '../features/judgment-log/hooks/useAgendas'

/**
 * User Story 3 - 투자 안건 작성과 합의 기록(FR-016~FR-020, FR-022, FR-023).
 * 안건 작성 → 상대 운영자 의견 → 합의 확정(의견 0건도 허용) → 확정 목록
 * 재조회 흐름을 Mock 데이터로 완성한다.
 */
export function JudgmentLogPage() {
  const { user } = useAuth()
  const [selectedAgendaId, setSelectedAgendaId] = useState<string | null>(null)

  const agendasQuery = useAgendas()
  const detailQuery = useAgendaDetail(selectedAgendaId)

  if (agendasQuery.isLoading) {
    return <LoadingState label="판단 로그를 불러오는 중" />
  }

  if (agendasQuery.isError || !agendasQuery.data) {
    return <ErrorState onRetry={() => agendasQuery.refetch()} />
  }

  const canEdit =
    !!user &&
    !!detailQuery.data &&
    detailQuery.data.agenda.status === 'discussing' &&
    detailQuery.data.agenda.authorUserId === user.id

  return (
    <div>
      <DisclaimerBanner />

      <section>
        <h2>안건 작성</h2>
        <AgendaForm
          mode="create"
          disabled={agendasQuery.createAgenda.isPending}
          onSubmit={({ title, body }) => {
            if (!user) return
            agendasQuery.createAgenda.mutate({
              title,
              body,
              authorUserId: user.id,
              authorDisplayName: user.displayName,
            })
          }}
        />
      </section>

      <section>
        <h2>안건 목록</h2>
        <AgendaList
          agendas={agendasQuery.data}
          selectedAgendaId={selectedAgendaId}
          onSelectAgenda={setSelectedAgendaId}
        />
      </section>

      {selectedAgendaId ? (
        <section>
          <h2>안건 상세</h2>
          {detailQuery.isLoading ? (
            <LoadingState label="안건 상세를 불러오는 중" />
          ) : detailQuery.isError || !detailQuery.data ? (
            <ErrorState onRetry={() => detailQuery.refetch()} />
          ) : (
            <div>
              {detailQuery.data.agenda.status === 'discussing' ? (
                <StatusBadge label="논의중" tone="warning" />
              ) : (
                <StatusBadge label="합의완료" tone="success" />
              )}

              {canEdit ? (
                <AgendaForm
                  mode="edit"
                  initialTitle={detailQuery.data.agenda.title}
                  initialBody={detailQuery.data.agenda.body}
                  disabled={detailQuery.updateAgenda.isPending}
                  onSubmit={({ title, body }) => {
                    if (!user) return
                    detailQuery.updateAgenda.mutate({
                      title,
                      body,
                      requestedByUserId: user.id,
                    })
                  }}
                />
              ) : (
                <div>
                  <h3>{detailQuery.data.agenda.title}</h3>
                  <p>{detailQuery.data.agenda.body}</p>
                </div>
              )}

              <h3>의견</h3>
              <OpinionThread
                opinions={detailQuery.data.opinions}
                disabled={detailQuery.addOpinion.isPending}
                onSubmit={(body) => {
                  if (!user) return
                  detailQuery.addOpinion.mutate({
                    body,
                    authorUserId: user.id,
                    authorDisplayName: user.displayName,
                  })
                }}
              />

              <AgreementConfirmButton
                disabled={detailQuery.data.agenda.status === 'agreed'}
                pending={detailQuery.confirmAgreement.isPending}
                onConfirm={() => {
                  if (!user) return
                  detailQuery.confirmAgreement.mutate({
                    confirmedByUserId: user.id,
                    confirmedByDisplayName: user.displayName,
                  })
                }}
              />
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}

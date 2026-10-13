import { useState } from 'react'
import { useAuth } from '../app/providers/AuthProvider'
import { DisclaimerBanner } from '../components/layout/DisclaimerBanner'
import { ErrorState } from '../components/ui/ErrorState'
import { LoadingState } from '../components/ui/LoadingState'
import { StatusBadge } from '../components/ui/StatusBadge'
import { formatDateTime } from '../lib/format'
import { AgendaForm } from '../features/judgment-log/components/AgendaForm'
import { AgendaList } from '../features/judgment-log/components/AgendaList'
import { AgreementConfirmButton } from '../features/judgment-log/components/AgreementConfirmButton'
import { OpinionThread } from '../features/judgment-log/components/OpinionThread'
import { useAgendaDetail } from '../features/judgment-log/hooks/useAgendaDetail'
import { useAgendas } from '../features/judgment-log/hooks/useAgendas'

/** 저장 실패 사유. 성공 전에는 폼을 닫거나 비우지 않으므로 같은 버튼으로 다시 시도한다 */
function failureMessage(mutation: { isError?: boolean; error?: Error | null }) {
  return mutation.isError ? (mutation.error?.message ?? '저장에 실패했습니다.') : null
}

/**
 * User Story 3 - 투자 안건 작성과 합의 기록(FR-016~FR-023).
 * 안건 작성 → 상대 운영자 의견 → 합의 확정(의견 0건도 허용) → 확정 목록
 * 재조회, 합의완료 안건의 사유 있는 수정과 변경 이력(FR-021).
 */
export function JudgmentLogPage() {
  const { user } = useAuth()
  const [selectedAgendaId, setSelectedAgendaId] = useState<string | null>(null)
  const [isComposing, setIsComposing] = useState(false)
  const [isEditingAgreed, setIsEditingAgreed] = useState(false)

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
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setIsComposing((prev) => !prev)}
        >
          안건 작성
        </button>
      </div>

      {isComposing ? (
        <section style={{ marginBottom: 24 }}>
          <h2>새 안건 작성</h2>
          <AgendaForm
            mode="create"
            disabled={agendasQuery.createAgenda.isPending}
            submitError={failureMessage(agendasQuery.createAgenda)}
            onSubmit={({ title, body }, onSaved) => {
              if (!user) return
              agendasQuery.createAgenda.mutate(
                {
                  title,
                  body,
                  authorUserId: user.id,
                  authorDisplayName: user.displayName,
                },
                {
                  onSuccess: () => {
                    onSaved()
                    setIsComposing(false)
                  },
                },
              )
            }}
          />
        </section>
      ) : null}

      <div className="judgment-log-layout">
        <section>
          <h2>안건 목록</h2>
          <AgendaList
            agendas={agendasQuery.data}
            selectedAgendaId={selectedAgendaId}
            onSelectAgenda={(agendaId) => {
              setSelectedAgendaId(agendaId)
              setIsEditingAgreed(false)
            }}
          />
        </section>

        <section>
          <h2>안건 상세</h2>
          {!selectedAgendaId ? (
            <p style={{ color: 'var(--color-text-muted)' }}>
              좌측 목록에서 안건을 선택하면 상세 내용이 표시됩니다.
            </p>
          ) : detailQuery.isLoading ? (
            <LoadingState label="안건 상세를 불러오는 중" />
          ) : detailQuery.isError || !detailQuery.data ? (
            <ErrorState onRetry={() => detailQuery.refetch()} />
          ) : (
            // 안건이 바뀌면 패널을 새로 만들어 이전 안건의 수정 폼·의견 입력이 따라오지 않게 한다
            <div key={selectedAgendaId} className="agenda-detail-panel">
              <div className="agenda-detail-panel__head">
                <div>
                  {detailQuery.data.agenda.status === 'discussing' ? (
                    <StatusBadge label="논의중" tone="warning" />
                  ) : (
                    <StatusBadge label="합의완료" tone="neutral" />
                  )}
                  <h3 style={{ margin: '6px 0 0' }}>{detailQuery.data.agenda.title}</h3>
                </div>
                <span className="num" style={{ fontSize: '0.75rem' }}>
                  작성자: {detailQuery.data.agenda.authorDisplayName} ·{' '}
                  {formatDateTime(detailQuery.data.agenda.createdAt)}
                </span>
              </div>

              {canEdit ? (
                <AgendaForm
                  mode="edit"
                  initialTitle={detailQuery.data.agenda.title}
                  initialBody={detailQuery.data.agenda.body}
                  disabled={detailQuery.updateAgenda.isPending}
                  submitError={failureMessage(detailQuery.updateAgenda)}
                  onSubmit={({ title, body }) => {
                    if (!user) return
                    detailQuery.updateAgenda.mutate({
                      title,
                      body,
                      requestedByUserId: user.id,
                      requestedByDisplayName: user.displayName,
                    })
                  }}
                />
              ) : detailQuery.data.agenda.status === 'agreed' && isEditingAgreed ? (
                <div>
                  <p className="agreement-action-bar__hint">
                    합의된 내용을 바꾸면 이전 제목·내용과 사유가 변경 이력으로 남습니다.
                  </p>
                  <AgendaForm
                    mode="edit"
                    requireReason
                    initialTitle={detailQuery.data.agenda.title}
                    initialBody={detailQuery.data.agenda.body}
                    disabled={detailQuery.updateAgenda.isPending}
                    submitError={failureMessage(detailQuery.updateAgenda)}
                    onSubmit={({ title, body, reason }, onSaved) => {
                      if (!user) return
                      detailQuery.updateAgenda.mutate(
                        {
                          title,
                          body,
                          reason,
                          requestedByUserId: user.id,
                          requestedByDisplayName: user.displayName,
                        },
                        {
                          onSuccess: () => {
                            onSaved()
                            setIsEditingAgreed(false)
                          },
                        },
                      )
                    }}
                  />
                  <button
                    type="button"
                    className="btn"
                    disabled={detailQuery.updateAgenda.isPending}
                    onClick={() => setIsEditingAgreed(false)}
                  >
                    취소
                  </button>
                </div>
              ) : (
                <>
                  <p className="agenda-detail-panel__body">{detailQuery.data.agenda.body}</p>
                  {detailQuery.data.agenda.status === 'agreed' && user ? (
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        detailQuery.updateAgenda.reset()
                        setIsEditingAgreed(true)
                      }}
                    >
                      합의 내용 수정
                    </button>
                  ) : null}
                </>
              )}

              <div>
                <h3>의견 이력</h3>
                <OpinionThread
                  opinions={detailQuery.data.opinions}
                  disabled={detailQuery.addOpinion.isPending}
                  submitError={failureMessage(detailQuery.addOpinion)}
                  onSubmit={(body, onSaved) => {
                    if (!user) return
                    detailQuery.addOpinion.mutate(
                      {
                        body,
                        authorUserId: user.id,
                        authorDisplayName: user.displayName,
                      },
                      { onSuccess: onSaved },
                    )
                  }}
                />
              </div>

              <div className="agreement-action-bar">
                <p className="agreement-action-bar__hint">
                  양측 의견 조율 후 언제든 합의를 확정할 수 있습니다.
                </p>
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
              {failureMessage(detailQuery.confirmAgreement) ? (
                <p role="alert" className="state-error">
                  {failureMessage(detailQuery.confirmAgreement)}
                </p>
              ) : null}

              {detailQuery.data.agreementRecord ? (
                <p className="agreement-record-note">
                  확정자: {detailQuery.data.agreementRecord.confirmedByDisplayName} · 확정
                  시각: {formatDateTime(detailQuery.data.agreementRecord.confirmedAt)} ·
                  확정 시점 의견 {detailQuery.data.agreementRecord.opinionCountAtConfirmation}건
                </p>
              ) : null}

              {detailQuery.data.history.length > 0 ? (
                <div>
                  <h3>변경 이력</h3>
                  <ul className="list-reset" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {detailQuery.data.history.map((entry) => (
                      <li key={entry.id} className="opinion-card">
                        <div className="opinion-card__meta">
                          <strong style={{ color: 'var(--color-text)' }}>
                            {entry.changedByDisplayName}
                          </strong>
                          <span className="num">{formatDateTime(entry.changedAt)}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.85rem' }}>사유: {entry.reason}</p>
                        <details>
                          <summary style={{ fontSize: '0.75rem' }}>이전 내용 보기</summary>
                          <p style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
                            <strong>{entry.previousTitle}</strong>
                          </p>
                          <p style={{ margin: 0, fontSize: '0.85rem' }}>{entry.previousBody}</p>
                        </details>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>

      <DisclaimerBanner />
    </div>
  )
}

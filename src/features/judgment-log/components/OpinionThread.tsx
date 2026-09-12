import { useState, type FormEvent } from 'react'
import { formatDateTime } from '../../../lib/format'
import { opinionFormSchema } from '../../../lib/validation/agenda'
import { EmptyState } from '../../../components/ui/EmptyState'
import type { Opinion } from '../../../types/domain'

interface OpinionThreadProps {
  opinions: Opinion[]
  disabled?: boolean
  onSubmit: (body: string) => void
}

/** 의견 목록·작성, 1~2000자 검증, 작성자·작성 시각 함께 표시(FR-017, FR-022) */
export function OpinionThread({ opinions, disabled = false, onSubmit }: OpinionThreadProps) {
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const result = opinionFormSchema.safeParse({ body })
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? '입력값을 확인해주세요.')
      return
    }
    setError(null)
    onSubmit(result.data.body)
    setBody('')
  }

  return (
    <div>
      {opinions.length === 0 ? (
        <EmptyState message="아직 등록된 의견이 없습니다." />
      ) : (
        <ul className="list-reset" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {opinions.map((opinion) => (
            <li key={opinion.id} className="opinion-card">
              <div className="opinion-card__meta">
                <strong style={{ color: 'var(--color-text)' }}>
                  {opinion.authorDisplayName}
                </strong>
                <span className="num">{formatDateTime(opinion.createdAt)}</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>{opinion.body}</p>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="opinion-body">의견 작성</label>
          <textarea
            id="opinion-body"
            value={body}
            disabled={disabled}
            onChange={(event) => setBody(event.target.value)}
          />
        </div>
        {error ? (
          <p role="alert" className="state-error">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn btn-primary" disabled={disabled}>
          {disabled ? '저장 중' : '의견 등록'}
        </button>
      </form>
    </div>
  )
}

import { useState, type FormEvent } from 'react'
import { agendaFormSchema, agreedAgendaEditSchema } from '../../../lib/validation/agenda'

interface AgendaFormProps {
  mode: 'create' | 'edit'
  initialTitle?: string
  initialBody?: string
  disabled?: boolean
  /** 합의완료 안건 수정: 수정 사유(1~500자)를 함께 받는다(FR-021) */
  requireReason?: boolean
  /** 저장 실패 사유. 입력은 그대로 남아 있어 같은 버튼으로 다시 시도할 수 있다 */
  submitError?: string | null
  /** 저장이 성공했을 때 호출부가 onSaved를 부른다 — 그때만 입력을 비운다 */
  onSubmit: (input: { title: string; body: string; reason?: string }, onSaved: () => void) => void
}

/**
 * 안건 작성/수정 폼(제목 1~100자, 내용 1~2000자, 공백만 입력 거부, FR-016).
 * "논의중" 상태에서 작성자 본인만 수정 가능(FR-016a)한 것은 호출부에서
 * 이 폼을 렌더링할지 여부로 강제한다.
 */
export function AgendaForm({
  mode,
  initialTitle = '',
  initialBody = '',
  disabled = false,
  requireReason = false,
  submitError = null,
  onSubmit,
}: AgendaFormProps) {
  const [title, setTitle] = useState(initialTitle)
  const [body, setBody] = useState(initialBody)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const result = requireReason
      ? agreedAgendaEditSchema.safeParse({ title, body, reason })
      : agendaFormSchema.safeParse({ title, body })
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? '입력값을 확인해주세요.')
      return
    }
    setError(null)
    onSubmit(result.data, () => {
      if (mode === 'create') {
        setTitle('')
        setBody('')
      }
    })
  }

  const alertMessage = error ?? submitError

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="agenda-title">제목</label>
        <input
          id="agenda-title"
          value={title}
          disabled={disabled}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="agenda-body">내용</label>
        <textarea
          id="agenda-body"
          value={body}
          disabled={disabled}
          onChange={(event) => setBody(event.target.value)}
        />
      </div>
      {requireReason ? (
        <div className="field">
          <label htmlFor="agenda-reason">수정 사유</label>
          <textarea
            id="agenda-reason"
            value={reason}
            disabled={disabled}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
      ) : null}
      {alertMessage ? (
        <p role="alert" className="state-error">
          {alertMessage}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary" disabled={disabled}>
        {disabled
          ? '저장 중'
          : mode === 'create'
            ? '안건 작성'
            : requireReason
              ? '이력 남기고 수정'
              : '수정 저장'}
      </button>
    </form>
  )
}

import { useState, type FormEvent } from 'react'
import { agendaFormSchema } from '../../../lib/validation/agenda'

interface AgendaFormProps {
  mode: 'create' | 'edit'
  initialTitle?: string
  initialBody?: string
  disabled?: boolean
  onSubmit: (input: { title: string; body: string }) => void
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
  onSubmit,
}: AgendaFormProps) {
  const [title, setTitle] = useState(initialTitle)
  const [body, setBody] = useState(initialBody)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const result = agendaFormSchema.safeParse({ title, body })
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? '입력값을 확인해주세요.')
      return
    }
    setError(null)
    onSubmit(result.data)
    if (mode === 'create') {
      setTitle('')
      setBody('')
    }
  }

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
      {error ? (
        <p role="alert" className="state-error">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary" disabled={disabled}>
        {disabled ? '저장 중' : mode === 'create' ? '안건 작성' : '수정 저장'}
      </button>
    </form>
  )
}

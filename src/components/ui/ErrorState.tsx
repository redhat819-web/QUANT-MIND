interface ErrorStateProps {
  message?: string
  onRetry?: () => void
}

export function ErrorState({
  message = '데이터를 불러오지 못했습니다.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div role="alert" className="state state-error">
      <span>{message}</span>
      {onRetry ? (
        <button type="button" className="btn btn-outline" onClick={onRetry}>
          다시 시도
        </button>
      ) : null}
    </div>
  )
}

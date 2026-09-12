interface LoadingStateProps {
  label?: string
}

export function LoadingState({ label = '불러오는 중' }: LoadingStateProps) {
  return (
    <div role="status" className="state state-loading">
      <span className="state-spinner" aria-hidden="true" />
      <span>{label}...</span>
    </div>
  )
}

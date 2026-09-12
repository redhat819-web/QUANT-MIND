interface EmptyStateProps {
  message?: string
}

export function EmptyState({
  message = '아직 등록된 항목이 없습니다.',
}: EmptyStateProps) {
  return (
    <div role="status" className="state state-empty">
      <span>{message}</span>
    </div>
  )
}

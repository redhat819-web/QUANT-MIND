export type HoldingsViewMode = 'quick' | 'detail'

interface QuickModeToggleProps {
  mode: HoldingsViewMode
  onChange: (mode: HoldingsViewMode) => void
}

/** 빠른 확인 ↔ 상세 모드 전환 */
export function QuickModeToggle({ mode, onChange }: QuickModeToggleProps) {
  return (
    <div role="group" aria-label="보기 모드 전환" style={{ display: 'flex', gap: 8 }}>
      <button
        type="button"
        className="btn btn-secondary"
        aria-pressed={mode === 'quick'}
        onClick={() => onChange('quick')}
      >
        빠른 확인 모드
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        aria-pressed={mode === 'detail'}
        onClick={() => onChange('detail')}
      >
        상세 모드
      </button>
    </div>
  )
}

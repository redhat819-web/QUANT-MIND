export type HoldingsViewMode = 'quick' | 'detail'

interface QuickModeToggleProps {
  mode: HoldingsViewMode
  onChange: (mode: HoldingsViewMode) => void
}

/** 빠른 확인 ↔ 상세 모드 전환. 선택된 쪽만 보라로 강조(12px 라운드, pill 금지) */
export function QuickModeToggle({ mode, onChange }: QuickModeToggleProps) {
  return (
    <div role="group" aria-label="보기 모드 전환" className="mode-toggle">
      <button
        type="button"
        className="mode-toggle__btn"
        aria-pressed={mode === 'quick'}
        onClick={() => onChange('quick')}
      >
        빠른 확인
      </button>
      <button
        type="button"
        className="mode-toggle__btn"
        aria-pressed={mode === 'detail'}
        onClick={() => onChange('detail')}
      >
        상세
      </button>
    </div>
  )
}

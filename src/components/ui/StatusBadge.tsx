export type StatusTone = 'neutral' | 'success' | 'error' | 'warning'

interface StatusBadgeProps {
  label: string
  tone?: StatusTone
}

/**
 * 상태는 색상만으로 구분하지 않고 항상 텍스트 라벨과 함께 표시한다
 * (헌장 원칙 XIII). 색상은 aria-hidden 처리된 점(dot)에만 적용하고,
 * 실제 정보 전달은 텍스트가 담당한다.
 *
 * 시스템 상태 전용. 등락(상승/하락) 표시에는 .num--rise / .num--fall을 사용한다.
 */
export function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps) {
  return (
    <span className={`status-badge status-badge--${tone}`}>
      <span className="status-badge__dot" aria-hidden="true" />
      {label}
    </span>
  )
}

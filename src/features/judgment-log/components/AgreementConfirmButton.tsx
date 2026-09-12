interface AgreementConfirmButtonProps {
  disabled?: boolean
  pending?: boolean
  onConfirm: () => void
}

/** 의견 0건에서도 합의 확정을 허용한다(FR-019, Clarifications Q3) */
export function AgreementConfirmButton({
  disabled = false,
  pending = false,
  onConfirm,
}: AgreementConfirmButtonProps) {
  return (
    <button
      type="button"
      className="btn btn-primary"
      disabled={disabled || pending}
      onClick={onConfirm}
    >
      {pending ? '저장 중' : '합의 확정'}
    </button>
  )
}

interface PermissionDeniedStateProps {
  message?: string
}

/** 로그인하지 않은 사용자가 보호된 화면에 접근했을 때(FR-002) */
export function PermissionDeniedState({
  message = '로그인이 필요한 화면입니다.',
}: PermissionDeniedStateProps) {
  return (
    <div role="alert" className="state state-permission-denied">
      <span>권한 없음: {message}</span>
    </div>
  )
}

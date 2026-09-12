import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../app/providers/AuthProvider'
import { PermissionDeniedState } from '../components/ui/PermissionDeniedState'

export function LoginPage() {
  const { isAuthenticated, signIn } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'

  if (isAuthenticated) {
    return <Navigate to={from} replace />
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg)',
      }}
    >
      <div className="card" style={{ maxWidth: 360, width: '100%' }}>
        <div className="app-shell__brand" style={{ marginBottom: 24 }}>
          QUANT-MIND
        </div>
        <PermissionDeniedState message="계속하려면 로그인해주세요." />
        <button
          type="button"
          className="btn btn-primary"
          onClick={signIn}
          style={{ marginTop: 16, width: '100%' }}
        >
          로그인 (Mock)
        </button>
      </div>
    </div>
  )
}

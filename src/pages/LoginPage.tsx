import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../app/providers/AuthProvider'

export function LoginPage() {
  const { isAuthenticated, signIn } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (isAuthenticated) {
    return <Navigate to={from} replace />
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!email.trim() || !password.trim()) {
      setError('이메일 또는 비밀번호를 다시 확인해 주세요.')
      return
    }
    setError(null)
    signIn()
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <header style={{ marginBottom: 24 }}>
          <h1 className="login-card__title">QUANT-MIND</h1>
          <p className="login-card__subtitle">부부 공동 자산 관리 시스템</p>
        </header>

        {error ? (
          <p role="alert" className="state-error" style={{ marginBottom: 16 }}>
            {error}
          </p>
        ) : null}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="login-email">이메일</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="example@domain.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="login-password">비밀번호</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            로그인
          </button>
        </form>

        <div className="login-card__footer">두 명의 운영자만 사용하는 비공개 서비스입니다.</div>
      </div>
    </div>
  )
}

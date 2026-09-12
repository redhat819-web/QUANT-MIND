import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export interface AuthUser {
  id: string
  displayName: string
}

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  signIn: () => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/**
 * Mock 단계의 인증 상태 관리(FR-001). 실제 Supabase 연동(U4) 시 이 Provider
 * 내부만 supabase.auth 세션 구독으로 교체하고, 훅 인터페이스(useAuth)는
 * 그대로 유지한다.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      signIn: () => setUser({ id: 'user-me', displayName: '나' }),
      signOut: () => setUser(null),
    }),
    [user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth는 AuthProvider 내부에서만 사용할 수 있습니다.')
  }
  return context
}

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getSupabase } from '../../lib/supabase'
import { useDataSource } from './DataSourceProvider'

export interface AuthUser {
  id: string
  displayName: string
}

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  /** supabase 모드에서 저장된 세션을 확인하는 동안 true */
  isRestoring?: boolean
  /** 실패하면 사용자에게 보여줄 문구, 성공하면 null */
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const SIGN_IN_FAILED = '이메일 또는 비밀번호를 다시 확인해 주세요.'

function MockAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      signIn: async () => {
        setUser({ id: 'user-me', displayName: '나' })
        return null
      },
      signOut: () => setUser(null),
    }),
    [user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** supabase.auth 세션 구독(FR-001). 데이터 조회는 이 세션 기준 RLS를 따른다. */
function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isRestoring, setIsRestoring] = useState(true)

  useEffect(() => {
    const supabase = getSupabase()
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session ? { id: data.session.user.id, displayName: '나' } : null)
      setIsRestoring(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session ? { id: session.user.id, displayName: '나' } : null)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isRestoring,
      signIn: async (email, password) => {
        const { error } = await getSupabase().auth.signInWithPassword({ email, password })
        return error ? SIGN_IN_FAILED : null
      },
      signOut: () => {
        void getSupabase().auth.signOut()
      },
    }),
    [user, isRestoring],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** mock 모드는 입력값과 무관하게 로그인, supabase 모드는 이메일·비밀번호 로그인 */
export function AuthProvider({ children }: { children: ReactNode }) {
  return useDataSource() === 'supabase' ? (
    <SupabaseAuthProvider>{children}</SupabaseAuthProvider>
  ) : (
    <MockAuthProvider>{children}</MockAuthProvider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth는 AuthProvider 내부에서만 사용할 수 있습니다.')
  }
  return context
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

/**
 * supabase 모드에서만 호출한다(mock 모드는 이 모듈을 쓰지 않음). anon key만 쓰며,
 * 모든 조회는 로그인 세션(authenticated) 기준 RLS를 따른다(FR-003/FR-004).
 */
export function getSupabase(): SupabaseClient {
  if (client) return client
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error('VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY 환경변수가 없습니다.')
  }
  client = createClient(url, anonKey)
  return client
}

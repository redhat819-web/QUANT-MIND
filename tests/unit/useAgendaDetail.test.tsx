import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAgendaDetail } from '../../src/features/judgment-log/hooks/useAgendaDetail'

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useAgendaDetail', () => {
  it('안건이 바뀌면 이전 안건의 저장 실패 상태를 지운다', async () => {
    // 상세 조회는 성공, 의견 저장은 실패
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: { method?: string }) =>
        init?.method === 'POST'
          ? { ok: false, json: async () => ({}) }
          : { ok: true, json: async () => ({ agenda: {}, opinions: [], agreementRecord: null }) },
      ),
    )
    const { result, rerender } = renderHook(({ id }) => useAgendaDetail(id), {
      wrapper,
      initialProps: { id: 'agenda-1' },
    })

    act(() => {
      result.current.addOpinion.mutate({
        body: '의견',
        authorUserId: 'user-me',
        authorDisplayName: '나',
      })
    })
    await waitFor(() => expect(result.current.addOpinion.isError).toBe(true))

    rerender({ id: 'agenda-2' })

    await waitFor(() => expect(result.current.addOpinion.isError).toBe(false))
  })
})

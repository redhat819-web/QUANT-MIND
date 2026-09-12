import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { JudgmentLogPage } from '../../src/pages/JudgmentLogPage'
import * as useAgendasModule from '../../src/features/judgment-log/hooks/useAgendas'
import * as useAgendaDetailModule from '../../src/features/judgment-log/hooks/useAgendaDetail'
import * as useAuthModule from '../../src/app/providers/AuthProvider'
import type { Agenda, AgendaDetail } from '../../src/types/domain'

function mockAgenda(overrides: Partial<Agenda> = {}): Agenda {
  return {
    id: 'agenda-1',
    householdId: 'household-1',
    authorUserId: 'user-me',
    authorDisplayName: '나',
    title: '해외 ETF 비중 논의',
    body: '해외 ETF 비중을 늘리는 방안을 검토하자.',
    status: 'discussing',
    createdAt: '2026-09-04T21:10:00+09:00',
    updatedAt: '2026-09-04T21:10:00+09:00',
    ...overrides,
  }
}

function mockDetail(overrides: Partial<AgendaDetail> = {}): AgendaDetail {
  return {
    agenda: mockAgenda(),
    opinions: [],
    agreementRecord: null,
    ...overrides,
  }
}

function mockUseAuth(userId = 'user-me', displayName = '나') {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    user: { id: userId, displayName },
    isAuthenticated: true,
    signIn: vi.fn(),
    signOut: vi.fn(),
  })
}

function mockUseAgendas(state: Partial<ReturnType<typeof useAgendasModule.useAgendas>>) {
  vi.spyOn(useAgendasModule, 'useAgendas').mockReturnValue(
    state as ReturnType<typeof useAgendasModule.useAgendas>,
  )
}

function mockUseAgendaDetail(
  state: Partial<ReturnType<typeof useAgendaDetailModule.useAgendaDetail>>,
) {
  vi.spyOn(useAgendaDetailModule, 'useAgendaDetail').mockReturnValue(
    state as ReturnType<typeof useAgendaDetailModule.useAgendaDetail>,
  )
}

describe('JudgmentLogPage', () => {
  it('로딩 상태를 표시한다', () => {
    mockUseAuth()
    mockUseAgendas({ isLoading: true, isError: false, data: undefined })
    mockUseAgendaDetail({
      isLoading: false,
      isError: false,
      data: undefined,
      updateAgenda: { mutate: vi.fn(), isPending: false } as never,
      addOpinion: { mutate: vi.fn(), isPending: false } as never,
      confirmAgreement: { mutate: vi.fn(), isPending: false } as never,
    })
    render(<JudgmentLogPage />)
    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중')
  })

  it('제목 1~100자, 내용 1~2000자 검증을 통과하지 못하면 오류를 표시하고 제출하지 않는다', () => {
    mockUseAuth()
    const mutate = vi.fn()
    mockUseAgendas({
      isLoading: false,
      isError: false,
      data: [mockAgenda()],
      refetch: vi.fn(),
      createAgenda: { mutate, isPending: false } as never,
    })
    mockUseAgendaDetail({
      isLoading: false,
      isError: false,
      data: undefined,
      updateAgenda: { mutate: vi.fn(), isPending: false } as never,
      addOpinion: { mutate: vi.fn(), isPending: false } as never,
      confirmAgreement: { mutate: vi.fn(), isPending: false } as never,
    })
    render(<JudgmentLogPage />)

    fireEvent.change(screen.getByLabelText('제목'), { target: { value: '   ' } })
    fireEvent.change(screen.getByLabelText('내용'), { target: { value: '내용입니다' } })
    fireEvent.click(screen.getByRole('button', { name: '안건 작성' }))

    expect(mutate).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('"논의중" 상태에서 작성자 본인은 수정 폼을, 타인은 읽기 전용을 본다(FR-016a)', () => {
    mockUseAgendas({
      isLoading: false,
      isError: false,
      data: [mockAgenda()],
      refetch: vi.fn(),
      createAgenda: { mutate: vi.fn(), isPending: false } as never,
    })

    // 작성자 본인
    mockUseAuth('user-me', '나')
    mockUseAgendaDetail({
      isLoading: false,
      isError: false,
      data: mockDetail(),
      updateAgenda: { mutate: vi.fn(), isPending: false } as never,
      addOpinion: { mutate: vi.fn(), isPending: false } as never,
      confirmAgreement: { mutate: vi.fn(), isPending: false } as never,
    })
    const { unmount } = render(<JudgmentLogPage />)
    fireEvent.click(screen.getByRole('button', { name: '해외 ETF 비중 논의' }))
    expect(screen.getByRole('button', { name: '수정 저장' })).toBeInTheDocument()
    unmount()

    // 타인(상대방)
    mockUseAuth('user-partner', '상대방')
    render(<JudgmentLogPage />)
    fireEvent.click(screen.getByRole('button', { name: '해외 ETF 비중 논의' }))
    expect(screen.queryByRole('button', { name: '수정 저장' })).not.toBeInTheDocument()
    expect(screen.getByText('해외 ETF 비중 논의', { selector: 'h3' })).toBeInTheDocument()
  })

  it('의견 0건 상태에서도 합의 확정 버튼이 활성화된다(FR-019)', () => {
    mockUseAuth()
    mockUseAgendas({
      isLoading: false,
      isError: false,
      data: [mockAgenda()],
      refetch: vi.fn(),
      createAgenda: { mutate: vi.fn(), isPending: false } as never,
    })
    const confirmMutate = vi.fn()
    mockUseAgendaDetail({
      isLoading: false,
      isError: false,
      data: mockDetail({ opinions: [] }),
      updateAgenda: { mutate: vi.fn(), isPending: false } as never,
      addOpinion: { mutate: vi.fn(), isPending: false } as never,
      confirmAgreement: { mutate: confirmMutate, isPending: false } as never,
    })
    render(<JudgmentLogPage />)
    fireEvent.click(screen.getByRole('button', { name: '해외 ETF 비중 논의' }))

    const confirmButton = screen.getByRole('button', { name: '합의 확정' })
    expect(confirmButton).toBeEnabled()
    fireEvent.click(confirmButton)
    expect(confirmMutate).toHaveBeenCalledWith({
      confirmedByUserId: 'user-me',
      confirmedByDisplayName: '나',
    })
  })

  it('의견을 등록하면 addOpinion이 호출된다', async () => {
    mockUseAuth()
    mockUseAgendas({
      isLoading: false,
      isError: false,
      data: [mockAgenda()],
      refetch: vi.fn(),
      createAgenda: { mutate: vi.fn(), isPending: false } as never,
    })
    const addOpinionMutate = vi.fn()
    mockUseAgendaDetail({
      isLoading: false,
      isError: false,
      data: mockDetail(),
      updateAgenda: { mutate: vi.fn(), isPending: false } as never,
      addOpinion: { mutate: addOpinionMutate, isPending: false } as never,
      confirmAgreement: { mutate: vi.fn(), isPending: false } as never,
    })
    render(<JudgmentLogPage />)
    fireEvent.click(screen.getByRole('button', { name: '해외 ETF 비중 논의' }))

    fireEvent.change(screen.getByLabelText('의견 작성'), {
      target: { value: '좋은 생각이야' },
    })
    fireEvent.click(screen.getByRole('button', { name: '의견 등록' }))

    await waitFor(() => {
      expect(addOpinionMutate).toHaveBeenCalledWith({
        body: '좋은 생각이야',
        authorUserId: 'user-me',
        authorDisplayName: '나',
      })
    })
  })
})

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

    fireEvent.click(screen.getByRole('button', { name: '안건 작성' })) // 작성 폼 열기
    fireEvent.change(screen.getByLabelText('제목'), { target: { value: '   ' } })
    fireEvent.change(screen.getByLabelText('내용'), { target: { value: '내용입니다' } })
    const form = screen.getByLabelText('제목').closest('form')!
    fireEvent.click(within(form).getByRole('button', { name: '안건 작성' }))

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
    fireEvent.click(screen.getByRole('button', { name: /해외 ETF 비중 논의/ }))
    expect(screen.getByRole('button', { name: '수정 저장' })).toBeInTheDocument()
    unmount()

    // 타인(상대방)
    mockUseAuth('user-partner', '상대방')
    render(<JudgmentLogPage />)
    fireEvent.click(screen.getByRole('button', { name: /해외 ETF 비중 논의/ }))
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
    fireEvent.click(screen.getByRole('button', { name: /해외 ETF 비중 논의/ }))

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
    fireEvent.click(screen.getByRole('button', { name: /해외 ETF 비중 논의/ }))

    fireEvent.change(screen.getByLabelText('의견 작성'), {
      target: { value: '좋은 생각이야' },
    })
    fireEvent.click(screen.getByRole('button', { name: '의견 등록' }))

    await waitFor(() => {
      expect(addOpinionMutate).toHaveBeenCalledWith(
        {
          body: '좋은 생각이야',
          authorUserId: 'user-me',
          authorDisplayName: '나',
        },
        expect.anything(),
      )
    })
  })

  it('안건 저장이 실패하면 폼을 닫지 않고 입력과 실패 사유를 남긴다', () => {
    mockUseAuth()
    const mutate = vi.fn() // onSuccess를 부르지 않음 = 저장 실패
    mockUseAgendas({
      isLoading: false,
      isError: false,
      data: [mockAgenda()],
      refetch: vi.fn(),
      createAgenda: {
        mutate,
        isPending: false,
        isError: true,
        error: new Error('안건 작성에 실패했습니다.'),
      } as never,
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

    fireEvent.click(screen.getByRole('button', { name: '안건 작성' }))
    fireEvent.change(screen.getByLabelText('제목'), { target: { value: '리밸런싱' } })
    fireEvent.change(screen.getByLabelText('내용'), { target: { value: '현금 비중 조정' } })
    const form = screen.getByLabelText('제목').closest('form')!
    fireEvent.click(within(form).getByRole('button', { name: '안건 작성' }))

    expect(mutate).toHaveBeenCalled()
    expect(screen.getByLabelText('제목')).toHaveValue('리밸런싱')
    expect(screen.getByRole('alert')).toHaveTextContent('안건 작성에 실패했습니다.')
  })

  it('안건 저장이 성공해야 작성 폼을 닫는다', () => {
    mockUseAuth()
    const mutate = vi.fn((_input, options?: { onSuccess?: () => void }) => options?.onSuccess?.())
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

    fireEvent.click(screen.getByRole('button', { name: '안건 작성' }))
    fireEvent.change(screen.getByLabelText('제목'), { target: { value: '리밸런싱' } })
    fireEvent.change(screen.getByLabelText('내용'), { target: { value: '현금 비중 조정' } })
    const form = screen.getByLabelText('제목').closest('form')!
    fireEvent.click(within(form).getByRole('button', { name: '안건 작성' }))

    expect(screen.queryByLabelText('제목')).not.toBeInTheDocument()
  })

  it('의견 입력은 저장 성공 후에만 비운다', () => {
    mockUseAuth()
    mockUseAgendas({
      isLoading: false,
      isError: false,
      data: [mockAgenda()],
      refetch: vi.fn(),
      createAgenda: { mutate: vi.fn(), isPending: false } as never,
    })
    let saved: (() => void) | undefined
    const addOpinionMutate = vi.fn((_input, options?: { onSuccess?: () => void }) => {
      saved = options?.onSuccess
    })
    mockUseAgendaDetail({
      isLoading: false,
      isError: false,
      data: mockDetail(),
      updateAgenda: { mutate: vi.fn(), isPending: false } as never,
      addOpinion: { mutate: addOpinionMutate, isPending: false } as never,
      confirmAgreement: { mutate: vi.fn(), isPending: false } as never,
    })
    render(<JudgmentLogPage />)
    fireEvent.click(screen.getByRole('button', { name: /해외 ETF 비중 논의/ }))

    const textarea = screen.getByLabelText('의견 작성')
    fireEvent.change(textarea, { target: { value: '좋은 생각이야' } })
    fireEvent.click(screen.getByRole('button', { name: '의견 등록' }))
    expect(textarea).toHaveValue('좋은 생각이야')

    act(() => saved?.())
    expect(textarea).toHaveValue('')
  })

  it('합의 확정이 실패하면 실패 사유를 보여주고 버튼은 다시 누를 수 있다', () => {
    mockUseAuth()
    mockUseAgendas({
      isLoading: false,
      isError: false,
      data: [mockAgenda()],
      refetch: vi.fn(),
      createAgenda: { mutate: vi.fn(), isPending: false } as never,
    })
    mockUseAgendaDetail({
      isLoading: false,
      isError: false,
      data: mockDetail(),
      updateAgenda: { mutate: vi.fn(), isPending: false } as never,
      addOpinion: { mutate: vi.fn(), isPending: false } as never,
      confirmAgreement: {
        mutate: vi.fn(),
        isPending: false,
        isError: true,
        error: new Error('합의 확정에 실패했습니다.'),
      } as never,
    })
    render(<JudgmentLogPage />)
    fireEvent.click(screen.getByRole('button', { name: /해외 ETF 비중 논의/ }))

    expect(screen.getByRole('alert')).toHaveTextContent('합의 확정에 실패했습니다.')
    expect(screen.getByRole('button', { name: '합의 확정' })).toBeEnabled()
  })

  it('다른 안건을 선택하면 이전 안건의 수정 폼 값과 의견 입력이 따라오지 않는다', () => {
    mockUseAuth()
    const first = mockAgenda({ id: 'agenda-1', title: '첫째 안건', body: '첫째 내용' })
    const second = mockAgenda({ id: 'agenda-2', title: '둘째 안건', body: '둘째 내용' })
    mockUseAgendas({
      isLoading: false,
      isError: false,
      data: [first, second],
      refetch: vi.fn(),
      createAgenda: { mutate: vi.fn(), isPending: false } as never,
    })
    // 캐시된 안건처럼 로딩 없이 바로 데이터가 바뀌는 경우
    vi.spyOn(useAgendaDetailModule, 'useAgendaDetail').mockImplementation(
      (agendaId) =>
        ({
          isLoading: false,
          isError: false,
          data: agendaId ? mockDetail({ agenda: agendaId === 'agenda-1' ? first : second }) : undefined,
          updateAgenda: { mutate: vi.fn(), isPending: false },
          addOpinion: { mutate: vi.fn(), isPending: false },
          confirmAgreement: { mutate: vi.fn(), isPending: false },
        }) as never,
    )
    render(<JudgmentLogPage />)

    fireEvent.click(screen.getByRole('button', { name: /첫째 안건/ }))
    fireEvent.change(screen.getByLabelText('의견 작성'), { target: { value: '첫째에 쓴 의견' } })
    fireEvent.click(screen.getByRole('button', { name: /둘째 안건/ }))

    expect(screen.getByLabelText('제목')).toHaveValue('둘째 안건')
    expect(screen.getByLabelText('내용')).toHaveValue('둘째 내용')
    expect(screen.getByLabelText('의견 작성')).toHaveValue('')
  })
})

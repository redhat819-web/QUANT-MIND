import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DashboardPage } from '../../src/pages/DashboardPage'
import * as useDashboardSummaryModule from '../../src/features/dashboard/hooks/useDashboardSummary'
import type { DashboardSummary } from '../../src/types/domain'

function mockSummary(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
  return {
    me: {
      ownerUserId: 'user-me',
      ownerDisplayName: '나',
      totalMarketValueKrw: 8_370_000,
      weightedReturnRate: 0.06,
      asOfSyncedAt: '2026-09-05T19:00:00+09:00',
      hasSyncFailure: false,
    },
    partner: {
      ownerUserId: 'user-partner',
      ownerDisplayName: '상대방',
      totalMarketValueKrw: 9_200_000,
      weightedReturnRate: 0.13,
      asOfSyncedAt: '2026-09-04T19:00:00+09:00',
      hasSyncFailure: true,
    },
    household: {
      householdId: 'household-1',
      totalMarketValueKrw: 17_570_000,
      weightedReturnRate: 0.098,
      asOfSyncedAt: '2026-09-04T19:00:00+09:00',
      hasSyncFailure: true,
    },
    allocation: [
      { classification: 'growth', marketValueKrw: 13_450_000, weightRatio: 0.766 },
      { classification: 'defensive', marketValueKrw: 1_120_000, weightRatio: 0.064 },
      { classification: 'cash', marketValueKrw: 3_000_000, weightRatio: 0.171 },
    ],
    discussingAgendas: [{ id: 'agenda-1', title: '해외 ETF 비중 논의', status: 'discussing' }],
    ...overrides,
  }
}

function mockUseDashboardSummary(state: Partial<ReturnType<typeof useDashboardSummaryModule.useDashboardSummary>>) {
  vi.spyOn(useDashboardSummaryModule, 'useDashboardSummary').mockReturnValue(
    state as ReturnType<typeof useDashboardSummaryModule.useDashboardSummary>,
  )
}

describe('DashboardPage', () => {
  it('로딩 상태를 표시한다', () => {
    mockUseDashboardSummary({ isLoading: true, isError: false, data: undefined })
    render(<DashboardPage />)
    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중')
  })

  it('오류 상태를 표시하고 재시도 버튼을 제공한다', () => {
    mockUseDashboardSummary({ isLoading: false, isError: true, data: undefined })
    render(<DashboardPage />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
  })

  it('나/상대방/부부 합계 3단계 집계와 참고용 문구, 기준 시점을 함께 표시한다', () => {
    mockUseDashboardSummary({ isLoading: false, isError: false, data: mockSummary() })
    render(<DashboardPage />)

    expect(screen.getByText('나')).toBeInTheDocument()
    expect(screen.getByText('상대방')).toBeInTheDocument()
    expect(screen.getByText('부부 합계')).toBeInTheDocument()
    expect(screen.getByText('참고용 — 투자 권유 아님')).toBeInTheDocument()
    expect(screen.getByText(/기준 시점: 2026-09-04 19:00 기준/)).toBeInTheDocument()
    expect(screen.getByText('일부 계좌 동기화 실패')).toBeInTheDocument()
  })

  it('논의 중인 안건 요약을 표시한다', () => {
    mockUseDashboardSummary({ isLoading: false, isError: false, data: mockSummary() })
    render(<DashboardPage />)
    expect(screen.getByText('해외 ETF 비중 논의')).toBeInTheDocument()
    expect(screen.getByText('논의중')).toBeInTheDocument()
  })

  it('논의 중인 안건이 없으면 빈 목록 상태를 표시한다', () => {
    mockUseDashboardSummary({
      isLoading: false,
      isError: false,
      data: mockSummary({ discussingAgendas: [] }),
    })
    render(<DashboardPage />)
    expect(screen.getByText('논의 중인 안건이 없습니다.')).toBeInTheDocument()
  })
})

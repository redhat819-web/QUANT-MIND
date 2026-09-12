import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HoldingsPage } from '../../src/pages/HoldingsPage'
import * as useAccountsModule from '../../src/features/holdings/hooks/useAccounts'
import * as useHoldingDetailModule from '../../src/features/holdings/hooks/useHoldingDetail'
import type { AccountSummary, Holding } from '../../src/types/domain'

function mockAccount(overrides: Partial<AccountSummary> = {}): AccountSummary {
  return {
    accountId: 'acc-me-1',
    accountName: '나의 증권계좌 A',
    ownerDisplayName: '나',
    totalMarketValueKrw: 4_250_000,
    representativeReturnRate: 0.082,
    lastSyncedAt: '2026-09-05T19:00:00+09:00',
    lastSyncStatus: 'success',
    lastSyncError: null,
    ...overrides,
  }
}

function mockHolding(overrides: Partial<Holding> = {}): Holding {
  return {
    id: 'hold-1',
    accountId: 'acc-me-1',
    displayName: '삼성전자',
    quantity: 50,
    marketValueKrw: 4_250_000,
    returnRate: 0.082,
    classification: 'growth',
    ticker: '005930',
    currency: null,
    averageCost: 72000,
    dividend: 1600,
    isMapped: true,
    rawLabel: '삼성전자',
    ...overrides,
  }
}

function mockUseAccounts(state: Partial<ReturnType<typeof useAccountsModule.useAccounts>>) {
  vi.spyOn(useAccountsModule, 'useAccounts').mockReturnValue(
    state as ReturnType<typeof useAccountsModule.useAccounts>,
  )
}

function mockUseHoldingDetail(
  state: Partial<ReturnType<typeof useHoldingDetailModule.useHoldingDetail>>,
) {
  vi.spyOn(useHoldingDetailModule, 'useHoldingDetail').mockReturnValue(
    state as ReturnType<typeof useHoldingDetailModule.useHoldingDetail>,
  )
}

describe('HoldingsPage', () => {
  it('로딩 상태를 표시한다', () => {
    mockUseAccounts({ isLoading: true, isError: false, data: undefined })
    mockUseHoldingDetail({
      isLoading: false,
      isError: false,
      data: undefined,
      updateClassification: { mutate: vi.fn(), isPending: false } as never,
    })
    render(<HoldingsPage />)
    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중')
  })

  it('빠른 확인 모드에서 계좌명, 합계 평가금액, 대표 손익률을 표시한다', () => {
    mockUseAccounts({ isLoading: false, isError: false, data: [mockAccount()], refetch: vi.fn() })
    mockUseHoldingDetail({
      isLoading: false,
      isError: false,
      data: undefined,
      updateClassification: { mutate: vi.fn(), isPending: false } as never,
    })
    render(<HoldingsPage />)

    expect(screen.getByText('나의 증권계좌 A')).toBeInTheDocument()
    expect(screen.getByText('+8.2%')).toBeInTheDocument()
    expect(screen.queryByText('종목 상세')).not.toBeInTheDocument()
  })

  it('상세 모드로 전환하면 조건부 항목 null과 미매핑 종목이 함께 표시된다', () => {
    mockUseAccounts({ isLoading: false, isError: false, data: [mockAccount()], refetch: vi.fn() })
    mockUseHoldingDetail({
      isLoading: false,
      isError: false,
      data: [
        mockHolding(),
        mockHolding({
          id: 'hold-2',
          displayName: 'KODEX 국고채10년',
          ticker: null,
          currency: null,
          averageCost: null,
          dividend: null,
          classification: 'defensive',
        }),
        mockHolding({
          id: 'hold-3',
          displayName: '애플(미매핑 표기 차이)',
          isMapped: false,
          rawLabel: 'APPLE INC',
        }),
      ],
      updateClassification: { mutate: vi.fn(), isPending: false } as never,
    })
    render(<HoldingsPage />)

    fireEvent.click(screen.getByRole('button', { name: '상세 모드' }))

    expect(screen.getAllByText('데이터 없음').length).toBeGreaterThan(0)
    expect(screen.getByText('미매핑')).toBeInTheDocument()
    expect(screen.getByText(/APPLE INC/)).toBeInTheDocument()
  })

  it('분류를 수동으로 변경하면 즉시 화면에 반영된다', async () => {
    const mutate = vi.fn()
    mockUseAccounts({ isLoading: false, isError: false, data: [mockAccount()], refetch: vi.fn() })
    mockUseHoldingDetail({
      isLoading: false,
      isError: false,
      data: [mockHolding()],
      updateClassification: { mutate, isPending: false } as never,
    })
    render(<HoldingsPage />)

    fireEvent.click(screen.getByRole('button', { name: '상세 모드' }))
    const select = screen.getByLabelText('hold-1 분류')
    fireEvent.change(select, { target: { value: 'defensive' } })

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({ holdingId: 'hold-1', classification: 'defensive' })
    })
  })
})

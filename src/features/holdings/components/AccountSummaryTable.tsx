import { formatKrw, formatReturnRate, returnRateToneClass } from '../../../lib/format'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { EmptyState } from '../../../components/ui/EmptyState'
import type { AccountSummary } from '../../../types/domain'

interface AccountSummaryTableProps {
  accounts: AccountSummary[]
  selectedAccountId: string | null
  onSelectAccount: (accountId: string) => void
}

/** 빠른 확인 모드: 계좌명, 합계 평가금액, 대표 손익률(FR-009) */
export function AccountSummaryTable({
  accounts,
  selectedAccountId,
  onSelectAccount,
}: AccountSummaryTableProps) {
  if (accounts.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="table-scroll">
      <table className="account-summary-table">
        <thead>
          <tr>
            <th scope="col">계좌명</th>
            <th scope="col">소유자</th>
            <th scope="col">합계 평가금액</th>
            <th scope="col">대표 손익률</th>
            <th scope="col">동기화 상태</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((account) => (
            <tr key={account.accountId}>
              <td>
                <button
                  type="button"
                  aria-pressed={account.accountId === selectedAccountId}
                  onClick={() => onSelectAccount(account.accountId)}
                >
                  {account.accountName}
                </button>
              </td>
              <td>{account.ownerDisplayName}</td>
              <td className="num">{formatKrw(account.totalMarketValueKrw)}</td>
              <td className={returnRateToneClass(account.representativeReturnRate)}>
                {formatReturnRate(account.representativeReturnRate)}
              </td>
              <td>
                {account.lastSyncStatus === 'failed' ? (
                  <StatusBadge label="동기화 실패" tone="error" />
                ) : account.lastSyncStatus === 'success' ? (
                  <StatusBadge label="동기화 성공" tone="success" />
                ) : (
                  <StatusBadge label="동기화 이력 없음" tone="neutral" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

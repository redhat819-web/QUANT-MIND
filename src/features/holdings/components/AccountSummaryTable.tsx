import { formatAsOfTimestamp, formatKrw, formatReturnRate, returnRateToneClass } from '../../../lib/format'
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
            <th scope="col">마지막 동기화</th>
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
                <span className="num" style={{ color: 'var(--color-text-muted)' }}>
                  {formatAsOfTimestamp(account.lastSyncedAt).replace('기준 시점: ', '').replace(' 기준', '')}
                </span>
                {account.lastSyncStatus === 'failed' ? (
                  <span style={{ marginLeft: 8 }}>
                    <StatusBadge label="동기화 실패" tone="error" />
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

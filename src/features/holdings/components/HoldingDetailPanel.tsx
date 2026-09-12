import { formatKrw, formatReturnRate, returnRateToneClass } from '../../../lib/format'
import { EmptyState } from '../../../components/ui/EmptyState'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { ClassificationSelect } from './ClassificationSelect'
import type { Classification, Holding } from '../../../types/domain'

const NO_DATA = '데이터 없음'

interface HoldingDetailPanelProps {
  holdings: Holding[]
  pendingHoldingId: string | null
  onClassificationChange: (holdingId: string, classification: Classification) => void
}

/**
 * 상세 모드: 필수 항목 전체 + 조건부 항목(종목코드/통화/평균 매입가/배당)
 * null·미매핑 처리(FR-010, FR-012, FR-013, FR-015).
 */
export function HoldingDetailPanel({
  holdings,
  pendingHoldingId,
  onClassificationChange,
}: HoldingDetailPanelProps) {
  if (holdings.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="table-scroll">
      <table className="holding-detail-table">
        <thead>
          <tr>
            <th scope="col">종목명</th>
            <th scope="col">수량</th>
            <th scope="col">평가금액</th>
            <th scope="col">손익률</th>
            <th scope="col">분류</th>
            <th scope="col">종목코드</th>
            <th scope="col">통화</th>
            <th scope="col">평균 매입가</th>
            <th scope="col">배당</th>
            <th scope="col">매핑 상태</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((holding) => (
            <tr key={holding.id}>
              <td>
                {holding.displayName}
                {!holding.isMapped ? (
                  <span> ({holding.rawLabel})</span>
                ) : null}
              </td>
              <td className="num">{holding.quantity}</td>
              <td className="num">{formatKrw(holding.marketValueKrw)}</td>
              <td className={returnRateToneClass(holding.returnRate)}>
                {formatReturnRate(holding.returnRate)}
              </td>
              <td>
                <ClassificationSelect
                  holdingId={holding.id}
                  value={holding.classification}
                  disabled={pendingHoldingId === holding.id}
                  onChange={onClassificationChange}
                />
              </td>
              <td>{holding.ticker ?? NO_DATA}</td>
              <td>{holding.currency ?? NO_DATA}</td>
              <td>{holding.averageCost ?? NO_DATA}</td>
              <td>{holding.dividend ?? NO_DATA}</td>
              <td>
                {holding.isMapped ? (
                  <StatusBadge label="매핑됨" tone="success" />
                ) : (
                  <StatusBadge label="미매핑" tone="warning" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

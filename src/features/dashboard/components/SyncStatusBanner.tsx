import { formatAsOfTimestamp } from '../../../lib/format'
import { StatusBadge } from '../../../components/ui/StatusBadge'

interface SyncStatusBannerProps {
  asOfSyncedAt: string | null
  hasSyncFailure: boolean
}

/** "기준 시점: YYYY-MM-DD HH:mm 기준" 상시 표시(FR-024) */
export function SyncStatusBanner({
  asOfSyncedAt,
  hasSyncFailure,
}: SyncStatusBannerProps) {
  return (
    <div
      className="card"
      style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}
    >
      <span>{formatAsOfTimestamp(asOfSyncedAt)}</span>
      {hasSyncFailure ? (
        <StatusBadge label="일부 계좌 동기화 실패" tone="error" />
      ) : null}
    </div>
  )
}

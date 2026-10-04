const krwFormatter = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
})

export function formatKrw(value: number): string {
  return krwFormatter.format(value)
}

export function formatReturnRate(rate: number): string {
  const sign = rate > 0 ? '+' : ''
  return `${sign}${(rate * 100).toFixed(2)}%`
}

/** 등락 색상 클래스 결정(헌장 원칙 XXI: 상승 빨강 / 하락 파랑, 초록 미사용) */
export function returnRateToneClass(rate: number): string {
  if (rate > 0) return 'num num--rise'
  if (rate < 0) return 'num num--fall'
  return 'num'
}

export function formatWeightRatio(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`
}

// 표시 시각은 실행 환경(브라우저·CI)의 시간대와 무관하게 항상 한국 시간으로 맞춘다.
const seoulDateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** ISO 시각 → Asia/Seoul 기준 "YYYY-MM-DD HH:mm" */
function formatSeoulDateTime(isoTimestamp: string): string {
  const parts: Record<string, string> = {}
  for (const part of seoulDateTimeFormatter.formatToParts(new Date(isoTimestamp))) {
    parts[part.type] = part.value
  }
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`
}

/** "기준 시점: YYYY-MM-DD HH:mm 기준" 형태로 변환 (FR-024, Asia/Seoul) */
export function formatAsOfTimestamp(isoTimestamp: string | null): string {
  if (!isoTimestamp) return '기준 시점: 아직 동기화된 데이터가 없습니다'
  return `기준 시점: ${formatSeoulDateTime(isoTimestamp)} 기준`
}

/** "YYYY-MM-DD HH:mm" 형태의 범용 작성/수정 시각 표기(FR-018, FR-022, Asia/Seoul) */
export function formatDateTime(isoTimestamp: string): string {
  return formatSeoulDateTime(isoTimestamp)
}

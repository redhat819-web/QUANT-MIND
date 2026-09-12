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

/** "기준 시점: YYYY-MM-DD HH:mm 기준" 형태로 변환 (FR-024) */
export function formatAsOfTimestamp(isoTimestamp: string | null): string {
  if (!isoTimestamp) return '기준 시점: 아직 동기화된 데이터가 없습니다'

  const date = new Date(isoTimestamp)
  const pad = (n: number) => n.toString().padStart(2, '0')
  const formatted = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`

  return `기준 시점: ${formatted} 기준`
}

/** "YYYY-MM-DD HH:mm" 형태의 범용 작성/수정 시각 표기(FR-018, FR-022) */
export function formatDateTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * 로그·오류 메시지에는 행 번호와 오류 종류만 남긴다. 금액·종목명·항목명·계좌명은
 * 어떤 경우에도 로그에 쓰지 않는다 — 호출부에서 이 함수들만 사용해 로그를 남긴다.
 */

function logSyncInfo_(message) {
  Logger.log('[SYNC_INFO] %s', message);
}

/**
 * @param {string} context 어느 단계에서 난 오류인지(예: 'portfolio-block', 'spouse-stocks')
 * @param {number|string} [rowNumber] 1-indexed 행 번호. 없으면 'n/a'
 * @param {string} errorType 오류 종류 코드(예: 'BLOCK_SUM_MISMATCH', 'INVALID_NUMBER')
 */
function logSyncError_(context, rowNumber, errorType) {
  Logger.log(
    '[SYNC_ERROR] context=%s row=%s type=%s',
    context,
    rowNumber === undefined || rowNumber === null ? 'n/a' : rowNumber,
    errorType
  );
}

/**
 * 블록 합계 불일치. 금액은 남기지 않고 어느 열인지와 차이 구간만 남긴다.
 * @param {number|string} rowNumber 합계(Total) 행 1-indexed 번호
 * @param {string} column 'COST_KRW'(매입 원화) | 'MARKET_KRW'(평가 원화)
 * @param {string} bucket 'GT_1KRW_LT_1PCT'(1원 초과 1% 미만) | 'GE_1PCT'(1% 이상) |
 *   'TOTAL_MISSING'(합계 칸이 비어 있음). 1원 이하 차이는 일치로 보므로 로그되지 않는다.
 * @param {string} [context] 기본값 'portfolio-block'(배우자 탭은 'spouse-stocks')
 */
function logSyncSumMismatch_(rowNumber, column, bucket, context) {
  Logger.log(
    '[SYNC_ERROR] context=%s row=%s type=BLOCK_SUM_MISMATCH column=%s diff=%s',
    context || 'portfolio-block',
    rowNumber,
    column,
    bucket
  );
}

/**
 * Supabase RPC 실패. 요청 값은 남기지 않고 HTTP 상태·오류 code·message만 남긴다
 * (message의 따옴표 안 값은 호출부에서 가린 상태로 전달된다).
 */
function logSupabaseError_(functionName, status, code, message) {
  Logger.log('[SYNC_ERROR] context=supabase-rpc fn=%s status=%s code=%s message=%s', functionName, status, code, message);
}

/**
 * 블록 안 현금 행 합계와 Board 예수금이 1원 넘게 다름(동기화는 Board 값으로 계속).
 * @param {number|string} rowNumber 블록 안 첫 현금 행 1-indexed 번호
 * @param {string} bucket 'GT_1KRW_LT_1PCT' | 'GE_1PCT' (1%는 Board 예수금 기준)
 */
function logCashDiffWarn_(rowNumber, bucket) {
  Logger.log('[SYNC_WARN] context=portfolio-block row=%s type=CASH_BOARD_BLOCK_DIFF diff=%s', rowNumber, bucket);
}

/**
 * upsert_snapshot이 판 종목 삭제를 건너뛴 계좌. account_idx는 payload accounts 배열
 * 위치(1부터)로, 포트폴리오 계좌는 시트 블록 순서와 같다(진단의 block 번호).
 * @param {string} type 'PRUNE_SKIPPED_LARGE' | 'PRUNE_SKIPPED_EMPTY'
 */
function logPruneWarn_(accountIdx, type) {
  Logger.log('[SYNC_WARN] context=prune account_idx=%s type=%s', accountIdx, type);
}

/**
 * 동기화를 막지 않는 경고. 예: 자산분류 매핑에 없는 종목 → "미분류"로 저장하고 계속 진행.
 * @param {string} context 어느 단계에서 난 경고인지
 * @param {number|string} [rowNumber] 1-indexed 행 번호. 없으면 'n/a'
 * @param {string} warnType 경고 종류 코드(예: 'UNKNOWN_CLASSIFICATION')
 */
function logSyncWarn_(context, rowNumber, warnType) {
  Logger.log(
    '[SYNC_WARN] context=%s row=%s type=%s',
    context,
    rowNumber === undefined || rowNumber === null ? 'n/a' : rowNumber,
    warnType
  );
}

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

/**
 * "종목분류" 탭 읽기 — 지금은 이 탭이 분류의 유일한 정본이다(T056 메모).
 * 1행은 제목. A열 = 종목명 또는 티커(키), B열 = 업종(무시), C열 = 성장/방어/현금,
 * D열 = 비고(무시). 키(T:/N:)는 서버의 security_key_of()가 A열 값에서 계산한다.
 * 로그에는 행 번호와 종류만 남긴다.
 *
 * @return {Array|null} [{label, classification, row}] — 탭이 없거나 유효 규칙이
 *   0개면 null(서버가 기존 규칙을 그대로 둔다).
 */
function readClassificationRules_(spreadsheet) {
  var sheet = spreadsheet.getSheetByName(SHEET_CLASSIFICATION);
  if (!sheet) {
    // 분류 탭이 없어도 보유 종목 동기화는 계속한다 — 기존 규칙 유지
    logSyncWarn_('classification', 'n/a', 'RULES_EMPTY_SKIPPED');
    return null;
  }
  var values = sheet.getDataRange().getValues();

  var rules = [];
  for (var r = 1; r < values.length; r++) {
    var label = String(values[r][0] || '').trim();
    var classLabel = String(values[r][2] || '').trim();
    if (label === '' || classLabel === '') {
      continue; // 키나 분류가 빈 행은 조용히 건너뜀(미분류로 남음)
    }
    var classification = CLASSIFICATION_MAP[classLabel];
    if (!classification) {
      logSyncWarn_('classification', r + 1, 'UNKNOWN_CLASSIFICATION_LABEL');
      continue;
    }
    rules.push({ label: label, classification: classification, row: r + 1 });
  }

  if (rules.length === 0) {
    logSyncWarn_('classification', 'n/a', 'RULES_EMPTY_SKIPPED');
    return null;
  }
  return rules;
}

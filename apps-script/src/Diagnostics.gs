/**
 * 읽기 전용 진단. Apps Script 편집기에서 직접 실행한다(트리거/메뉴 미등록, DB 미접근).
 * 블록마다 시트 순서 번호, 계좌 순번, 행 번호, 종목 행 수, 자산분류가 "현금"인 행
 * 번호만 남긴다 — 금액·종목명·계좌명은 남기지 않는다.
 *
 * 계좌 순번(account_ord)은 DB 검증 쿼리와 같은 기준이다:
 *   dense_rank() over (order by owner_type collate "C", account_name collate "C")
 * (JS 문자열 비교도 코드 포인트 순서라 결과가 같다. 배우자 탭 계좌는 포함하지 않는다.)
 */
function diagnosePortfolioBlocks() {
  var spreadsheet = openAllowedSpreadsheet_();
  var values = getSheetByNameStrict_(spreadsheet, SHEET_PORTFOLIO).getDataRange().getValues();
  var blocks = findPortfolioBlocks_(values);
  var childAccountNames = getChildAccountNames_();

  var keys = blocks.map(function (block) {
    var ownerType = childAccountNames.indexOf(block.accountName) !== -1 ? 'child' : 'member';
    return { ownerType: ownerType, name: block.accountName };
  });
  var sorted = keys.slice().sort(function (a, b) {
    if (a.ownerType !== b.ownerType) return a.ownerType < b.ownerType ? -1 : 1;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });

  for (var i = 0; i < blocks.length; i++) {
    var block = blocks[i];
    var cols = findPortfolioBlockColumns_(values, block);
    var stockRows = 0;
    var cashRows = [];
    for (var r = block.firstStockRow; r < block.totalRow; r++) {
      if (String(values[r][cols.name] || '').trim() === '') continue;
      stockRows += 1;
      if (String(values[r][cols.classification] || '').trim() === '현금') {
        var hasCode = String(values[r][cols.code] || '').trim() !== '';
        cashRows.push(r + 1 + (hasCode ? '(code)' : '(no-code)'));
      }
    }
    var ord = 1;
    for (var s = 0; s < sorted.length; s++) {
      if (sorted[s].ownerType === keys[i].ownerType && sorted[s].name === keys[i].name) {
        ord = s + 1;
        break;
      }
    }
    Logger.log(
      '[DIAG] block=%s account_ord=%s owner=%s start_row=%s total_row=%s stock_rows=%s cash_rows=[%s]',
      i + 1,
      ord,
      keys[i].ownerType,
      block.blockStartRow + 1,
      block.totalRow + 1,
      stockRows,
      cashRows.join(',')
    );
  }
}

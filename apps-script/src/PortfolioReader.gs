/**
 * 포트폴리오 탭(본인·자녀, 블록 반복형) + 상단 Account Board(계좌별 예수금) 읽기.
 *
 * 실제 시트 캡처로 확인된 구조:
 * - 환율표: "통화"와 "환율"이 함께 있는 제목 행이 있고, 그 아래 데이터 행에서
 *   통화 열 값이 "USD"인 행의 환율 열 값을 쓴다(제목 셀 오른쪽이 아니라 아래쪽).
 * - Account Board: "계좌명"과 "예수금"이 같은 행에 있는 제목 행이 있고, 그
 *   바로 아래 행에 KRW/USD 하위 열 이름이 있다. 계좌명이 빈 맨 아래 합계 행은
 *   건너뛴다.
 * - Board의 계좌명과 블록 제목(계좌 블록 A열 계좌명)이 일부 다를 수 있어
 *   스크립트 속성 BOARD_TO_BLOCK_ACCOUNT(JSON)로 매핑한다. 매핑해도 블록
 *   계좌명과 일치하지 않는 Board 행이 있으면 동기화를 멈춘다("매핑 필요").
 */

function readPortfolioSheet_(spreadsheet) {
  var sheet = getSheetByNameStrict_(spreadsheet, SHEET_PORTFOLIO);
  var values = sheet.getDataRange().getValues();

  var blocks = findPortfolioBlocks_(values);
  if (blocks.length === 0) {
    throw new Error('BLOCK_NOT_FOUND');
  }

  var blockAccountNames = {};
  for (var b = 0; b < blocks.length; b++) {
    blockAccountNames[blocks[b].accountName] = true;
  }

  var accounts = [];
  for (var i = 0; i < blocks.length; i++) {
    accounts.push(buildPortfolioAccountPayload_(values, blocks[i]));
  }

  var boardEndRow = blocks[0].blockStartRow; // 첫 블록 시작 행 바로 위까지가 Account Board 영역
  var cashAccounts = readAccountBoardCash_(values, boardEndRow, blockAccountNames);
  mergeBoardCashIntoBlocks_(accounts, cashAccounts);

  return accounts;
}

/**
 * Board 예수금을 같은 계좌의 블록 payload에 합쳐 계좌당 payload 항목을 하나로 만든다.
 * 같은 계좌가 두 번 오면 뒤 항목(Board, success)이 앞 항목(블록, failed)의 상태를
 * upsert로 덮어쓰기 때문이다. 블록이 failed면 예수금도 반영하지 않고(기존 데이터
 * 유지), 예수금이 failed면 계좌 전체를 failed로 둔다.
 */
function mergeBoardCashIntoBlocks_(blockAccounts, cashAccounts) {
  var byName = {};
  for (var i = 0; i < blockAccounts.length; i++) {
    byName[blockAccounts[i].account_name] = blockAccounts[i];
  }
  for (var j = 0; j < cashAccounts.length; j++) {
    var cash = cashAccounts[j];
    var block = byName[cash.account_name]; // readAccountBoardCash_가 블록에 없는 계좌는 이미 걸러냄
    if (block.sync_status !== 'success') {
      continue;
    }
    if (cash.sync_status === 'success' && block._blockCashKrw !== null && block._blockCashKrw !== undefined) {
      var diffBucket = checkBlockSum_(cash.holdings[0].market_value_krw, block._blockCashKrw, block._blockCashRow);
      if (diffBucket) {
        logCashDiffWarn_(block._blockCashRow, diffBucket);
      }
    }
    if (cash.sync_status !== 'success') {
      block.sync_status = 'failed';
      block.sync_error = cash.sync_error;
      block.holdings = [];
      continue;
    }
    block.holdings = block.holdings.concat(cash.holdings);
  }
  for (var k = 0; k < blockAccounts.length; k++) {
    delete blockAccounts[k]._blockCashKrw;
    delete blockAccounts[k]._blockCashRow;
  }
}

/**
 * A열을 스캔해 "계좌명 있음 + 다음 행 A열 == 종목명" 패턴으로 블록 시작을 찾고,
 * "Total" 행으로 블록 끝을 찾는다. 셀 주소를 고정하지 않는다.
 */
function findPortfolioBlocks_(values) {
  var blocks = [];
  for (var r = 0; r < values.length - 1; r++) {
    var colA = String(values[r][0] || '').trim();
    var nextColA = String(values[r + 1][0] || '').trim();
    if (colA !== '' && nextColA === PORTFOLIO_STOCK_HEADERS.name) {
      var headerRow = r + 1;
      var totalRow = -1;
      for (var t = headerRow + 1; t < values.length; t++) {
        if (String(values[t][0] || '').trim() === PORTFOLIO_BLOCK_TOTAL_LABEL) {
          totalRow = t;
          break;
        }
      }
      if (totalRow === -1) {
        throw new Error('BLOCK_TOTAL_ROW_NOT_FOUND:' + (r + 1));
      }
      blocks.push({
        blockStartRow: r,
        accountName: colA,
        headerRow: headerRow,
        firstStockRow: headerRow + 1,
        totalRow: totalRow,
      });
      r = totalRow; // 다음 블록 탐색은 Total 행 다음부터
    }
  }
  return blocks;
}

/**
 * 병합 셀은 왼쪽 첫 칸에만 값이 있으므로, topRowValues[col]에서 왼쪽으로 가장
 * 가까운 비어있지 않은 칸의 값을 그 칸이 속한 묶음 제목으로 본다.
 */
function findMergedGroupLabel_(topRowValues, col) {
  for (var c = col; c >= 0; c--) {
    var text = String(topRowValues[c] || '').trim();
    if (text !== '') {
      return text;
    }
  }
  return '';
}

/**
 * 블록의 2줄 헤더(윗줄=병합 묶음 제목, 아랫줄="종목명" 행)에서 종목 열 인덱스를
 * 찾는다. costKrw/marketValueKrw는 아랫줄 "원화" 칸 중 윗줄 묶음 제목이 각각
 * "매수가"/"현재가"인 첫 칸을 쓴다.
 */
function findPortfolioBlockColumns_(values, block) {
  var topRow = values[block.blockStartRow];
  var bottomRow = values[block.headerRow];

  var columns = {};
  var costCol = -1;
  var marketCol = -1;

  for (var c = 0; c < bottomRow.length; c++) {
    var label = String(bottomRow[c] || '').trim();
    if (label === PORTFOLIO_STOCK_HEADERS.name && columns.name === undefined) {
      columns.name = c;
    } else if (label === PORTFOLIO_STOCK_HEADERS.code && columns.code === undefined) {
      columns.code = c;
    } else if (label === PORTFOLIO_STOCK_HEADERS.classification && columns.classification === undefined) {
      columns.classification = c;
    } else if (label === PORTFOLIO_STOCK_HEADERS.currency && columns.currency === undefined) {
      columns.currency = c;
    } else if (label === PORTFOLIO_STOCK_HEADERS.quantity && columns.quantity === undefined) {
      columns.quantity = c;
    } else if (label === PORTFOLIO_STOCK_HEADERS.krwSubLabel) {
      var groupLabel = findMergedGroupLabel_(topRow, c);
      if (groupLabel === PORTFOLIO_STOCK_HEADERS.costGroupLabel && costCol === -1) {
        costCol = c;
      } else if (groupLabel === PORTFOLIO_STOCK_HEADERS.marketGroupLabel && marketCol === -1) {
        marketCol = c;
      }
    }
  }

  var simpleKeys = ['name', 'code', 'classification', 'currency', 'quantity'];
  for (var i = 0; i < simpleKeys.length; i++) {
    var key = simpleKeys[i];
    if (columns[key] === undefined) {
      throw new Error('HEADER_NOT_FOUND:portfolio-block:' + PORTFOLIO_STOCK_HEADERS[key]);
    }
  }
  if (costCol === -1) {
    throw new Error('HEADER_NOT_FOUND:portfolio-block:' + PORTFOLIO_STOCK_HEADERS.costGroupLabel + '/' + PORTFOLIO_STOCK_HEADERS.krwSubLabel);
  }
  if (marketCol === -1) {
    throw new Error('HEADER_NOT_FOUND:portfolio-block:' + PORTFOLIO_STOCK_HEADERS.marketGroupLabel + '/' + PORTFOLIO_STOCK_HEADERS.krwSubLabel);
  }

  columns.costKrw = costCol;
  columns.marketValueKrw = marketCol;
  return columns;
}

function toNumberOrNull_(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  var n = Number(value);
  return isNaN(n) ? null : n;
}

/** Google Sheets 오류값(#N/A, #REF!, #VALUE!, #DIV/0!, #NUM!, #NAME?, #NULL!, #ERROR!) 여부. */
function isSheetErrorValue_(value) {
  return typeof value === 'string' && /^#(N\/A|REF!|VALUE!|DIV\/0!|NUM!|NAME\?|NULL!|ERROR!)/.test(value);
}

/**
 * 블록 합계 칸과 행 합을 비교해 불일치 구간 코드를 돌려준다(일치면 null).
 * 반올림 오차를 고려해 1원 이하 차이는 일치로 본다. 1%는 합계 칸 값 기준.
 */
function checkBlockSum_(totalCell, rowSum, rowNumber) {
  if (isSheetErrorValue_(totalCell)) {
    logSyncWarn_('portfolio-block', rowNumber, 'TOTAL_ERROR_VALUE_SKIPPED');
    return null;
  }
  var total = toNumberOrNull_(totalCell);
  if (total === null) {
    return 'TOTAL_MISSING';
  }
  var diff = Math.abs(total - rowSum);
  if (diff <= 1) {
    return null;
  }
  return diff < Math.abs(total) * 0.01 ? 'GT_1KRW_LT_1PCT' : 'GE_1PCT';
}

function buildPortfolioAccountPayload_(values, block) {
  var cols = findPortfolioBlockColumns_(values, block);

  var isChild = getChildAccountNames_().indexOf(block.accountName) !== -1;
  var ownerType = isChild ? 'child' : 'member';
  var ownerUserId = isChild ? null : getMeUserId_();
  var ownerLabel = isChild ? block.accountName : null;

  var holdings = [];
  var sumMarketValue = 0;
  var sumCostKrw = 0;
  var hasCostKrw = false;
  var syncError = null;
  var blockCashKrw = 0;
  var blockCashFirstRow = null;

  for (var r = block.firstStockRow; r < block.totalRow; r++) {
    var name = String(values[r][cols.name] || '').trim();
    if (name === '') {
      continue; // 종목명이 빈 행은 건너뜀
    }

    var marketValue = toNumberOrNull_(values[r][cols.marketValueKrw]);
    if (marketValue === null) {
      syncError = 'INVALID_MARKET_VALUE';
      logSyncError_('portfolio-block', r + 1, syncError);
      continue;
    }

    var costKrw = toNumberOrNull_(values[r][cols.costKrw]);
    if (costKrw !== null) {
      hasCostKrw = true;
    }

    var classificationLabel = String(values[r][cols.classification] || '').trim();
    var classification = CLASSIFICATION_MAP[classificationLabel] || null;
    if (!classification) {
      logSyncWarn_('portfolio-block', r + 1, 'UNKNOWN_CLASSIFICATION');
    }

    sumMarketValue += marketValue;
    if (costKrw !== null) {
      sumCostKrw += costKrw;
    }

    // 블록 안 현금 행은 Board 예수금과 같은 돈이므로 종목으로 저장하지 않는다(A안).
    // 합계 검증(Total)에는 포함되므로 위에서 합산은 하고, Board와 비교용으로만 모은다.
    if (classification === 'cash') {
      blockCashKrw += marketValue;
      if (blockCashFirstRow === null) blockCashFirstRow = r + 1;
      continue;
    }

    holdings.push({
      raw_label: name,
      display_name: name,
      quantity: toNumberOrNull_(values[r][cols.quantity]) || 0,
      market_value_krw: marketValue,
      return_rate: costKrw && costKrw !== 0 ? (marketValue - costKrw) / costKrw : 0,
      cost_krw: costKrw,
      ticker: String(values[r][cols.code] || '').trim() || null,
      currency: String(values[r][cols.currency] || '').trim() || null,
      average_cost: null,
      dividend: null,
      classification: classification,
    });
  }

  // 합계 검증은 원화 두 열(평가 원화·매입 원화)만 한다. 외화 열은 비교하지 않는다.
  // 행의 오류값 셀은 위 루프에서 이미 합계에서 빠지며, 합계 칸 자체가 오류값이면
  // 그 열은 비교를 건너뛴다.
  var totalRowNumber = block.totalRow + 1;
  var marketMismatch = checkBlockSum_(values[block.totalRow][cols.marketValueKrw], sumMarketValue, totalRowNumber);
  if (marketMismatch) {
    logSyncSumMismatch_(totalRowNumber, 'MARKET_KRW', marketMismatch);
  }
  var costMismatch = hasCostKrw ? checkBlockSum_(values[block.totalRow][cols.costKrw], sumCostKrw, totalRowNumber) : null;
  if (costMismatch) {
    logSyncSumMismatch_(totalRowNumber, 'COST_KRW', costMismatch);
  }
  if (syncError === null && (marketMismatch || costMismatch)) {
    syncError = 'BLOCK_SUM_MISMATCH';
  }

  if (syncError) {
    return {
      account_name: block.accountName,
      owner_type: ownerType,
      owner_user_id: ownerUserId,
      owner_label: ownerLabel,
      source_sheet_id: getSpreadsheetId_(),
      sync_status: 'failed',
      sync_error: syncError,
      holdings: [],
    };
  }

  return {
    account_name: block.accountName,
    owner_type: ownerType,
    owner_user_id: ownerUserId,
    owner_label: ownerLabel,
    source_sheet_id: getSpreadsheetId_(),
    sync_status: 'success',
    sync_error: null,
    holdings: holdings,
    // payload 전송 전 mergeBoardCashIntoBlocks_가 지우는 내부 필드(Board 예수금 비교용)
    _blockCashKrw: blockCashFirstRow === null ? null : blockCashKrw,
    _blockCashRow: blockCashFirstRow,
  };
}

/**
 * 상단 Account Board에서 계좌별 예수금(현금)을 읽는다. 제목 행은 "계좌명"과
 * "예수금"이 같은 행에 있는 것으로 찾고, KRW/USD 하위 열 이름은 그 바로 아래
 * 행에서 찾는다. Board 계좌명은 스크립트 속성 BOARD_TO_BLOCK_ACCOUNT로 블록
 * 계좌명과 맞춘 뒤 그 이름으로 payload를 만든다(같은 account 행으로 upsert되도록).
 */
function readAccountBoardCash_(values, boardEndRow, blockAccountNames) {
  var boardToBlockAccount = getBoardToBlockAccountMap_();
  var childAccountNames = getChildAccountNames_();

  var headerRow = -1;
  var accountCol = -1;

  for (var r = 0; r < boardEndRow; r++) {
    var accCandidate = -1;
    var cashCandidate = -1;
    for (var c = 0; c < values[r].length; c++) {
      var text = String(values[r][c] || '').trim();
      if (text.indexOf('계좌명') !== -1) accCandidate = c;
      if (text.indexOf('예수금') !== -1) cashCandidate = c;
    }
    if (accCandidate !== -1 && cashCandidate !== -1) {
      headerRow = r;
      accountCol = accCandidate;
      break;
    }
  }

  if (headerRow === -1) {
    throw new Error('BOARD_HEADER_NOT_FOUND');
  }

  var subHeaderRow = headerRow + 1;
  var krwCol = -1;
  var usdCol = -1;
  if (subHeaderRow < boardEndRow) {
    for (var sc = 0; sc < values[subHeaderRow].length; sc++) {
      var subText = String(values[subHeaderRow][sc] || '').trim();
      if (subText.indexOf('KRW') !== -1) krwCol = sc;
      if (subText.indexOf('USD') !== -1) usdCol = sc;
    }
  }
  if (krwCol === -1) {
    throw new Error('BOARD_SUBHEADER_NOT_FOUND');
  }

  var exchangeRate = usdCol !== -1 ? findExchangeRate_(values, boardEndRow) : null;

  var accounts = [];
  var unmappedCount = 0;

  for (var row = subHeaderRow + 1; row < boardEndRow; row++) {
    var boardAccountName = String(values[row][accountCol] || '').trim();
    if (boardAccountName === '') {
      continue; // 맨 아래 합계 행 등 계좌명 없는 행은 건너뜀
    }

    var mappedName = boardToBlockAccount[boardAccountName] || boardAccountName;
    if (!blockAccountNames[mappedName]) {
      unmappedCount += 1;
      logSyncError_('account-board', row + 1, 'ACCOUNT_MAPPING_REQUIRED');
      continue;
    }

    var krwValue = values[row][krwCol];
    var krwAmount = toNumberOrNull_(krwValue);
    var syncError = null;

    if (krwValue !== '' && krwValue !== null && krwAmount === null) {
      syncError = 'INVALID_CASH_VALUE';
      logSyncError_('account-board', row + 1, syncError);
    }
    var totalKrw = krwAmount || 0;

    if (!syncError && usdCol !== -1) {
      var usdAmount = toNumberOrNull_(values[row][usdCol]);
      if (values[row][usdCol] !== '' && values[row][usdCol] !== null && usdAmount === null) {
        syncError = 'INVALID_CASH_VALUE';
        logSyncError_('account-board', row + 1, syncError);
      } else if (usdAmount) {
        if (!exchangeRate) {
          syncError = 'MISSING_EXCHANGE_RATE';
          logSyncError_('account-board', row + 1, syncError);
        } else {
          totalKrw += usdAmount * exchangeRate;
        }
      }
    }

    var isChild = childAccountNames.indexOf(mappedName) !== -1;
    var ownerType = isChild ? 'child' : 'member';

    if (syncError) {
      accounts.push({
        account_name: mappedName,
        owner_type: ownerType,
        owner_user_id: isChild ? null : getMeUserId_(),
        owner_label: isChild ? mappedName : null,
        source_sheet_id: getSpreadsheetId_(),
        sync_status: 'failed',
        sync_error: syncError,
        holdings: [],
      });
      continue;
    }

    accounts.push({
      account_name: mappedName,
      owner_type: ownerType,
      owner_user_id: isChild ? null : getMeUserId_(),
      owner_label: isChild ? mappedName : null,
      source_sheet_id: getSpreadsheetId_(),
      sync_status: 'success',
      sync_error: null,
      holdings: [
        {
          raw_label: '예수금',
          display_name: '예수금',
          quantity: 1,
          market_value_krw: totalKrw,
          return_rate: 0,
          cost_krw: totalKrw,
          ticker: null,
          currency: null,
          average_cost: null,
          dividend: null,
          classification: 'cash',
        },
      ],
    });
  }

  if (unmappedCount > 0) {
    throw new Error('ACCOUNT_MAPPING_REQUIRED');
  }

  return accounts;
}

/**
 * "통화"와 "환율"이 함께 있는 제목 행을 찾고, 그 아래 데이터 행에서 통화 열
 * 값이 "USD"인 행의 환율 열 값을 읽는다(제목 셀 오른쪽이 아니라 아래쪽 데이터).
 */
function findExchangeRate_(values, boardEndRow) {
  var headerRow = -1;
  var currencyCol = -1;
  var rateCol = -1;

  for (var r = 0; r < boardEndRow; r++) {
    var currencyCandidate = -1;
    var rateCandidate = -1;
    for (var c = 0; c < values[r].length; c++) {
      var text = String(values[r][c] || '').trim();
      if (text.indexOf('통화') !== -1) currencyCandidate = c;
      if (text.indexOf('환율') !== -1) rateCandidate = c;
    }
    if (currencyCandidate !== -1 && rateCandidate !== -1) {
      headerRow = r;
      currencyCol = currencyCandidate;
      rateCol = rateCandidate;
      break;
    }
  }

  if (headerRow === -1) {
    logSyncError_('fx-table', 'n/a', 'FX_ROW_NOT_FOUND');
    return null;
  }

  for (var row = headerRow + 1; row < boardEndRow; row++) {
    var currencyText = String(values[row][currencyCol] || '').trim();
    if (currencyText === 'USD') {
      var rate = toNumberOrNull_(values[row][rateCol]);
      if (rate) {
        return rate;
      }
    }
  }
  logSyncError_('fx-table', 'n/a', 'FX_ROW_NOT_FOUND');
  return null;
}

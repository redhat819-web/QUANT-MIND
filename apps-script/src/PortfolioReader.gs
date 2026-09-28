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
  accounts = accounts.concat(cashAccounts);

  return accounts;
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

function findHeaderColumns_(headerRowValues, headerLabels, context) {
  var columns = {};
  var keys = Object.keys(headerLabels);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var label = headerLabels[key];
    var col = -1;
    for (var c = 0; c < headerRowValues.length; c++) {
      if (String(headerRowValues[c] || '').trim() === label) {
        col = c;
        break;
      }
    }
    if (col === -1) {
      throw new Error('HEADER_NOT_FOUND:' + context + ':' + label);
    }
    columns[key] = col;
  }
  return columns;
}

function toNumberOrNull_(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  var n = Number(value);
  return isNaN(n) ? null : n;
}

function buildPortfolioAccountPayload_(values, block) {
  var cols = findHeaderColumns_(values[block.headerRow], PORTFOLIO_STOCK_HEADERS, 'portfolio-block');

  var isChild = getChildAccountNames_().indexOf(block.accountName) !== -1;
  var ownerType = isChild ? 'child' : 'member';
  var ownerUserId = isChild ? null : getMeUserId_();
  var ownerLabel = isChild ? block.accountName : null;

  var holdings = [];
  var sumMarketValue = 0;
  var sumCostKrw = 0;
  var hasCostKrw = false;
  var syncError = null;

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
    var classification = CLASSIFICATION_MAP[classificationLabel];
    if (!classification) {
      syncError = 'UNKNOWN_CLASSIFICATION';
      logSyncError_('portfolio-block', r + 1, syncError);
      continue;
    }

    sumMarketValue += marketValue;
    if (costKrw !== null) {
      sumCostKrw += costKrw;
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

  var totalMarketValue = toNumberOrNull_(values[block.totalRow][cols.marketValueKrw]);
  if (syncError === null && (totalMarketValue === null || Math.abs(totalMarketValue - sumMarketValue) > 0.5)) {
    syncError = 'BLOCK_SUM_MISMATCH';
    logSyncError_('portfolio-block', block.totalRow + 1, syncError);
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

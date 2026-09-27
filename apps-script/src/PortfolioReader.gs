/**
 * 포트폴리오 탭(본인·자녀, 블록 반복형) + 상단 Account Board(계좌별 예수금) 읽기.
 *
 * 가정(시트를 직접 볼 수 없어 사용자 설명을 그대로 코드화함 — 실제 실행 시 헤더
 * 문구가 다르면 즉시 에러로 멈추도록 설계했다. 다르면 여기서 멈추고 알려줄 것):
 * - Account Board는 첫 번째 계좌 블록 시작行보다 위에 있고, 헤더 행에 "계좌"를
 *   포함한 셀과 "예수금"을 포함한 셀이 함께 존재한다.
 * - USD 환산용 환율표는 상단 어딘가에 "환율"이라는 셀과 그 오른쪽 숫자 셀로
 *   존재한다(달러 예수금이 있을 때만 사용).
 */

function readPortfolioSheet_(spreadsheet) {
  var sheet = getSheetByNameStrict_(spreadsheet, SHEET_PORTFOLIO);
  var values = sheet.getDataRange().getValues();

  var blocks = findPortfolioBlocks_(values);
  if (blocks.length === 0) {
    throw new Error('포트폴리오 탭에서 계좌 블록을 찾지 못함(시트 구조 확인 필요)');
  }

  var accounts = [];
  for (var i = 0; i < blocks.length; i++) {
    accounts.push(buildPortfolioAccountPayload_(values, blocks[i]));
  }

  var boardEndRow = blocks[0].blockStartRow; // 첫 블록 시작 행 바로 위까지가 Account Board 영역
  var cashAccounts = readAccountBoardCash_(values, boardEndRow);
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
        throw new Error('블록의 Total 행을 찾지 못함(블록 시작 행 ' + (r + 1) + ')');
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
      throw new Error(context + ': 헤더 열을 찾지 못함(' + key + ')');
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

  var isChild = CHILD_ACCOUNT_NAMES.indexOf(block.accountName) !== -1;
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
 * 상단 Account Board에서 계좌별 예수금(현금)을 읽는다. 헤더 행은 "계좌"를 포함한
 * 셀과 "예수금"을 포함한 셀이 같은 행에 있는 것으로 찾는다. USD 열이 있으면
 * "환율" 셀 오른쪽의 숫자로 원화 환산한다.
 */
function readAccountBoardCash_(values, boardEndRow) {
  var headerRow = -1;
  var accountCol = -1;
  var krwCol = -1;
  var usdCol = -1;

  for (var r = 0; r < boardEndRow; r++) {
    var accCandidate = -1;
    var krwCandidate = -1;
    var usdCandidate = -1;
    for (var c = 0; c < values[r].length; c++) {
      var text = String(values[r][c] || '').trim();
      if (text.indexOf('계좌') !== -1) accCandidate = c;
      if (text.indexOf('예수금') !== -1 && text.indexOf('달러') === -1 && text.indexOf('USD') === -1) {
        krwCandidate = c;
      }
      if (text.indexOf('예수금') !== -1 && (text.indexOf('달러') !== -1 || text.indexOf('USD') !== -1)) {
        usdCandidate = c;
      }
    }
    if (accCandidate !== -1 && krwCandidate !== -1) {
      headerRow = r;
      accountCol = accCandidate;
      krwCol = krwCandidate;
      usdCol = usdCandidate;
      break;
    }
  }

  if (headerRow === -1) {
    throw new Error('Account Board 헤더를 찾지 못함(시트 구조 확인 필요)');
  }

  var exchangeRate = usdCol !== -1 ? findExchangeRate_(values, boardEndRow) : null;

  var accounts = [];
  for (var row = headerRow + 1; row < boardEndRow; row++) {
    var accountName = String(values[row][accountCol] || '').trim();
    if (accountName === '') {
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

    var isChild = CHILD_ACCOUNT_NAMES.indexOf(accountName) !== -1;
    var ownerType = isChild ? 'child' : 'member';

    if (syncError) {
      accounts.push({
        account_name: accountName,
        owner_type: ownerType,
        owner_user_id: isChild ? null : getMeUserId_(),
        owner_label: isChild ? accountName : null,
        source_sheet_id: getSpreadsheetId_(),
        sync_status: 'failed',
        sync_error: syncError,
        holdings: [],
      });
      continue;
    }

    accounts.push({
      account_name: accountName,
      owner_type: ownerType,
      owner_user_id: isChild ? null : getMeUserId_(),
      owner_label: isChild ? accountName : null,
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

  return accounts;
}

function findExchangeRate_(values, boardEndRow) {
  for (var r = 0; r < boardEndRow; r++) {
    for (var c = 0; c < values[r].length - 1; c++) {
      var text = String(values[r][c] || '').trim();
      if (text.indexOf('환율') !== -1) {
        var rate = toNumberOrNull_(values[r][c + 1]);
        if (rate) {
          return rate;
        }
      }
    }
  }
  return null;
}

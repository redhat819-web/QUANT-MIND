/**
 * 배우자_주식현황(주식) + 배우자_자산(현금성) 탭 읽기.
 * 소유자는 항상 owner_type='member' + owner_user_id=SPOUSE_USER_ID다 — "배우자"라는
 * 라벨은 화면에서 로그인한 사람 기준으로 붙이는 것이지 DB에 저장하는 값이 아니다.
 */

var SPOUSE_TOTAL_MARKER = '합계';

/**
 * 헤더 행에서 라벨별 열 인덱스를 전부 모은 뒤, "마지막(두 번째) occurrence만
 * 쓰는" 열(costKrw="매입가")과 "첫 occurrence를 쓰는" 나머지 열을 구분해 반환한다.
 * 증권사(A열)는 헤더가 없어 열 인덱스 0으로 고정한다.
 */
function findSpouseStockColumns_(headerRowValues) {
  var occurrences = {};
  for (var c = 0; c < headerRowValues.length; c++) {
    var label = String(headerRowValues[c] || '').trim();
    if (label === '') continue;
    if (!occurrences[label]) occurrences[label] = [];
    occurrences[label].push(c);
  }

  var keys = Object.keys(SPOUSE_STOCK_HEADERS);
  var columns = { broker: 0 };
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var label = SPOUSE_STOCK_HEADERS[key];
    var cols = occurrences[label];
    if (!cols || cols.length === 0) {
      throw new Error('HEADER_NOT_FOUND:spouse-stocks:' + label);
    }
    columns[key] = key === 'costKrw' ? cols[cols.length - 1] : cols[0];
  }
  return columns;
}

function readSpouseStocksSheet_(spreadsheet) {
  var sheet = getSheetByNameStrict_(spreadsheet, SHEET_SPOUSE_STOCKS);
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    throw new Error('SPOUSE_STOCKS_EMPTY');
  }

  var cols = findSpouseStockColumns_(values[0]);

  var byBroker = {}; // 증권사 -> holdings[]
  var brokerOrder = [];
  var sumMarketValue = 0;
  var totalRowValue = null;
  var hasFatalError = false;

  for (var r = 1; r < values.length; r++) {
    var broker = String(values[r][cols.broker] || '').trim();
    var name = String(values[r][cols.name] || '').trim();

    if (broker.indexOf(SPOUSE_TOTAL_MARKER) !== -1 || name.indexOf(SPOUSE_TOTAL_MARKER) !== -1) {
      totalRowValue = toNumberOrNull_(values[r][cols.marketValueKrw]);
      continue;
    }

    if (broker === '' || name === '') {
      continue; // 증권사·종목명 없는 행은 종목으로 인정하지 않음
    }

    var quantity = toNumberOrNull_(values[r][cols.quantity]);
    var marketValue = toNumberOrNull_(values[r][cols.marketValueKrw]);
    var costKrw = toNumberOrNull_(values[r][cols.costKrw]);

    if (quantity === null || marketValue === null || costKrw === null) {
      continue; // 보유수량·자산현황·매입가(원화)가 숫자가 아니면 종목으로 인정하지 않음
    }

    if (!byBroker[broker]) {
      byBroker[broker] = [];
      brokerOrder.push(broker);
    }

    sumMarketValue += marketValue;
    byBroker[broker].push({
      raw_label: name,
      display_name: name,
      quantity: quantity,
      market_value_krw: marketValue,
      return_rate: costKrw !== 0 ? (marketValue - costKrw) / costKrw : 0,
      cost_krw: costKrw,
      ticker: null,
      currency: null,
      average_cost: null,
      dividend: null,
      classification: null, // mapping_rule 조회로 서버에서 결정
    });
  }

  if (totalRowValue !== null && Math.abs(totalRowValue - sumMarketValue) > 0.5) {
    logSyncError_('spouse-stocks', 'n/a', 'BLOCK_SUM_MISMATCH');
    hasFatalError = true;
  }

  var accounts = [];
  for (var i = 0; i < brokerOrder.length; i++) {
    var brokerName = brokerOrder[i];
    if (hasFatalError) {
      accounts.push({
        account_name: brokerName,
        owner_type: 'member',
        owner_user_id: getSpouseUserId_(),
        owner_label: null,
        source_sheet_id: getSpreadsheetId_(),
        sync_status: 'failed',
        sync_error: 'BLOCK_SUM_MISMATCH',
        holdings: [],
      });
    } else {
      accounts.push({
        account_name: brokerName,
        owner_type: 'member',
        owner_user_id: getSpouseUserId_(),
        owner_label: null,
        source_sheet_id: getSpreadsheetId_(),
        sync_status: 'success',
        sync_error: null,
        holdings: byBroker[brokerName],
      });
    }
  }

  return accounts;
}

/**
 * 허용 목록(스크립트 속성 SPOUSE_CASH_ALLOWLIST)에 있는 항목명만 읽는다. 탭
 * 내용을 로그로 출력하지 않는다 — 허용 목록은 스크립트 속성에 JSON으로 채워 넣는다.
 */
function readSpouseAssetsSheet_(spreadsheet) {
  var sheet = getSheetByNameStrict_(spreadsheet, SHEET_SPOUSE_ASSETS);
  var values = sheet.getDataRange().getValues();

  var spouseCashAllowlist = getSpouseCashAllowlist_();
  if (spouseCashAllowlist.length === 0) {
    logSyncInfo_('SPOUSE_CASH_ALLOWLIST가 비어 있어 배우자_자산 탭에서 읽는 항목이 없음');
    return [];
  }

  var holdings = [];
  for (var r = 0; r < values.length; r++) {
    var itemName = String(values[r][0] || '').trim();
    if (spouseCashAllowlist.indexOf(itemName) === -1) {
      continue;
    }
    var amount = toNumberOrNull_(values[r][1]);
    if (amount === null) {
      logSyncError_('spouse-assets', r + 1, 'INVALID_CASH_VALUE');
      continue;
    }
    holdings.push({
      raw_label: itemName,
      display_name: itemName,
      quantity: 1,
      market_value_krw: amount,
      return_rate: 0,
      cost_krw: amount,
      ticker: null,
      currency: null,
      average_cost: null,
      dividend: null,
      classification: 'cash',
    });
  }

  if (holdings.length === 0) {
    return [];
  }

  return [
    {
      account_name: '배우자 현금성 자산',
      owner_type: 'member',
      owner_user_id: getSpouseUserId_(),
      owner_label: null,
      source_sheet_id: getSpreadsheetId_(),
      sync_status: 'success',
      sync_error: null,
      holdings: holdings,
    },
  ];
}

/**
 * 동기화 대상 시트/탭 이름과 소유자 구분에 필요한 코드 상수.
 *
 * 보안 규칙: 열 수 있는 파일은 스크립트 속성 SPREADSHEET_ID의 파일 하나뿐이다.
 * 이 파일 어디에도 다른 스프레드시트 ID/URL을 적지 않는다.
 */

var SHEET_PORTFOLIO = '포트폴리오';
var SHEET_SPOUSE_STOCKS = '배우자_주식현황';
var SHEET_SPOUSE_ASSETS = '배우자_자산';

/**
 * 계좌 이름이 코드/저장소에 남지 않도록, 계좌명이 들어가는 값은 코드 상수가 아니라
 * 스크립트 속성(PropertiesService)에 JSON으로 저장한다. 속성이 없으면 빈 값으로
 * 처리한다 — 단, Account Board 계좌명이 포트폴리오 블록 계좌명과 매핑되지 않는 경우는
 * (매핑이 필요한데 비어 있는 것일 수 있으므로) 빈 값으로 넘어가지 않고 동기화를
 * "매핑 필요" 오류로 멈춘다.
 *
 * - CHILD_ACCOUNT_NAMES    (JSON 배열)  예) ["블록 제목 계좌명"]
 * - BOARD_TO_BLOCK_ACCOUNT (JSON 객체)  예) {"Board 계좌명": "블록 제목 계좌명"}
 * - SPOUSE_CASH_ALLOWLIST  (JSON 배열)  예) ["배우자_자산 탭 항목명"]
 *
 * Apps Script 편집기 좌측 톱니바퀴 → 프로젝트 설정 → 스크립트 속성에서 입력한다.
 */
function getJsonScriptProperty_(key, defaultValue) {
  var raw = PropertiesService.getScriptProperties().getProperty(key);
  if (!raw) {
    return defaultValue;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error('스크립트 속성이 올바른 JSON이 아님: ' + key);
  }
}

/** 포트폴리오 탭의 블록 반복 구간에서 A열 계좌명이 이 목록에 있으면 "자녀" 소유로 간주한다. */
function getChildAccountNames_() {
  return getJsonScriptProperty_('CHILD_ACCOUNT_NAMES', []);
}

/**
 * 배우자_자산 탭에서 읽을 항목명 허용 목록(현금성 자산만). 이 목록에 없는 항목명은
 * 전부 무시한다(부동산·대출·연금 등을 Feature 001 범위에서 배제하기 위함).
 */
function getSpouseCashAllowlist_() {
  return getJsonScriptProperty_('SPOUSE_CASH_ALLOWLIST', []);
}

/**
 * Account Board(상단 계좌별 예수금 표)의 계좌명이 포트폴리오 블록 제목의 계좌명과
 * 다른 경우(예: ISA는 블록 제목이 더 김) 여기서 매핑한다. 키는 Board 계좌명, 값은
 * 블록 제목 계좌명이다. 매핑이 없거나 틀리면 동기화가 "매핑 필요" 오류로 멈춘다.
 */
function getBoardToBlockAccountMap_() {
  return getJsonScriptProperty_('BOARD_TO_BLOCK_ACCOUNT', {});
}

/** 포트폴리오 탭 종목 블록의 헤더 행에서 찾을 열 이름(셀 주소 고정 금지). */
var PORTFOLIO_STOCK_HEADERS = {
  name: '종목명',
  code: '종목코드',
  classification: '자산분류',
  currency: '통화',
  quantity: '주식수',
  costKrw: '매수가 원화 합계',
  marketValueKrw: '현재가 원화 합계',
};

var PORTFOLIO_BLOCK_TOTAL_LABEL = 'Total';

/** 배우자_주식현황 탭 1행 헤더에서 찾을 열 이름. */
var SPOUSE_STOCK_HEADERS = {
  broker: '증권사',
  name: '종목명',
  quantity: '보유수량',
  marketValueKrw: '자산현황',
  costKrw: '매입가(원화)',
  tickerLabel: '티커(설명)',
};

/** 포트폴리오 탭 자산분류 한글 표기 → DB classification enum 매핑. */
var CLASSIFICATION_MAP = {
  성장: 'growth',
  방어: 'defensive',
  현금: 'cash',
};

function getScriptProperty_(key) {
  var value = PropertiesService.getScriptProperties().getProperty(key);
  if (!value) {
    throw new Error('스크립트 속성 누락: ' + key);
  }
  return value;
}

function getSpreadsheetId_() {
  return getScriptProperty_('SPREADSHEET_ID');
}

function getSupabaseUrl_() {
  return getScriptProperty_('SUPABASE_URL');
}

function getSupabaseServiceRoleKey_() {
  return getScriptProperty_('SUPABASE_SERVICE_ROLE_KEY');
}

/** 이 앱은 부부 한 household만 다루므로 household_id를 스크립트 속성으로 고정한다. */
function getHouseholdId_() {
  return getScriptProperty_('HOUSEHOLD_ID');
}

/** 시트 원천 → 소유자 연결: 이메일이 아닌 Supabase auth 사용자 UUID로 설정한다. */
function getMeUserId_() {
  return getScriptProperty_('ME_USER_ID');
}

function getSpouseUserId_() {
  return getScriptProperty_('SPOUSE_USER_ID');
}

/** 열려도 되는 유일한 스프레드시트. 이 함수 외의 경로로 다른 파일을 열지 않는다. */
function openAllowedSpreadsheet_() {
  return SpreadsheetApp.openById(getSpreadsheetId_());
}

/**
 * 탭 이름을 지정해서만 읽는다 — getSheets()로 전체 탭 목록을 조회하지 않는다.
 * 지정한 이름의 탭이 없으면 즉시 실패시켜(시트 구조 불일치) 잘못된 탭을 추측해
 * 읽지 않도록 한다.
 */
function getSheetByNameStrict_(spreadsheet, sheetName) {
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('탭을 찾을 수 없음: ' + sheetName);
  }
  return sheet;
}

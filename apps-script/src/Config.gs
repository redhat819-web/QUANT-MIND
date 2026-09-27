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
 * 포트폴리오 탭의 블록 반복 구간에서 A열 계좌명이 이 목록에 있으면 "자녀" 소유로
 * 간주한다. 채우는 방법: 아래 배열에 실제 자녀 계좌명을 문자열로 추가한다.
 * 예) var CHILD_ACCOUNT_NAMES = ['지민 증권계좌'];
 * 비워두면 모든 계좌가 "나"(member) 소유로 처리된다.
 */
var CHILD_ACCOUNT_NAMES = [];

/**
 * 배우자_자산 탭에서 읽을 항목명 허용 목록(현금성 자산만). 이 목록에 없는 항목명은
 * 전부 무시한다(부동산·대출·연금 등을 Feature 001 범위에서 배제하기 위함).
 * 채우는 방법: 실제 항목명 문자열을 추가한다. 예)
 * var CASH_ITEM_ALLOWLIST = ['생활비 통장', '비상금 파킹통장'];
 * 이 탭의 내용을 로그로 출력하지 않는다 — 직접 시트를 열어 항목명을 확인해 채운다.
 */
var CASH_ITEM_ALLOWLIST = [];

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

/**
 * 동기화 진입점(T051/T053/T054). 시간 기반 트리거(매일 저녁 7시 Asia/Seoul)와
 * 스프레드시트 커스텀 메뉴 "지금 동기화" 둘 다 이 함수를 호출한다.
 *
 * 보안 규칙:
 * - 열리는 파일은 SPREADSHEET_ID 하나뿐(openAllowedSpreadsheet_).
 * - getSheets()로 탭 목록을 조회하지 않는다 — 지정된 3개 탭만 이름으로 연다.
 * - 기존 웹앱(Family AI v18.2)/Portfolio_Log_v2는 이 스크립트 어디서도 참조하지 않는다.
 * - 로그에는 행 번호와 오류 종류만 남긴다.
 */
function syncSnapshot() {
  var householdId = getHouseholdId_();
  var spreadsheet;

  try {
    spreadsheet = openAllowedSpreadsheet_();
  } catch (err) {
    // 스프레드시트 자체를 열지 못하면 어떤 계좌에도 상태를 붙일 수 없다 — Stackdriver
    // 로그만 남기고 종료한다(T054).
    logSyncError_('sync-root', 'n/a', 'FILE_OPEN_FAILED');
    throw err;
  }

  var accounts = [];
  var fatal = false;

  try {
    accounts = accounts.concat(readPortfolioSheet_(spreadsheet));
  } catch (err) {
    logSyncError_('portfolio', 'n/a', err.message);
    fatal = true;
  }

  if (getSpouseUserIdOptional_()) {
    try {
      accounts = accounts.concat(readSpouseStocksSheet_(spreadsheet));
    } catch (err) {
      logSyncError_('spouse-stocks', 'n/a', err.message);
      fatal = true;
    }

    try {
      accounts = accounts.concat(readSpouseAssetsSheet_(spreadsheet));
    } catch (err) {
      logSyncError_('spouse-assets', 'n/a', err.message);
      fatal = true;
    }
  } else {
    logSyncInfo_('SPOUSE_USER_ID 스크립트 속성이 없어 배우자 탭 동기화를 건너뜀');
  }

  if (fatal) {
    // 탭 구조 자체가 예상과 달라 데이터를 신뢰할 수 없다 — 부분 데이터를 반영하지
    // 않고 전체를 중단한다(잘못된 스냅샷으로 기존 값을 훼손하지 않기 위함).
    throw new Error('시트 읽기 실패로 동기화 중단(상세는 Stackdriver 로그 참조)');
  }

  var payload = {
    household_id: householdId,
    synced_at: new Date().toISOString(),
    accounts: accounts,
  };

  try {
    upsertSnapshot_(payload);
    logSyncInfo_('동기화 완료: 계좌 ' + accounts.length + '개 처리');
  } catch (err) {
    logSyncError_('sync-root', 'n/a', 'UPSERT_SNAPSHOT_FAILED');
    throw err;
  }
}

/** 시간 기반 트리거 등록: 매일 저녁 7시(Asia/Seoul) 1회. 이미 있으면 중복 등록하지 않는다. */
function ensureDailyTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'syncSnapshot') {
      return; // 이미 등록됨
    }
  }
  ScriptApp.newTrigger('syncSnapshot').timeBased().everyDays(1).atHour(19).inTimezone('Asia/Seoul').create();
}

/** 스프레드시트를 열 때 커스텀 메뉴 "지금 동기화"를 추가한다. */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Moamind').addItem('지금 동기화', 'syncSnapshot').addToUi();
}

/**
 * PostgREST RPC 호출 전용 클라이언트. service role key는 PropertiesService에서만
 * 읽으며(헌장 원칙 IV), 코드 어디에도 하드코딩하지 않는다.
 */

function callSupabaseRpc_(functionName, payload) {
  var url = getSupabaseUrl_().replace(/\/$/, '') + '/rest/v1/rpc/' + functionName;
  var serviceRoleKey = getSupabaseServiceRoleKey_();

  var response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      apikey: serviceRoleKey,
      Authorization: 'Bearer ' + serviceRoleKey,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  var status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    // 응답 본문 전체(details/hint 등)는 로그로 남기지 않는다 — code·message만 남긴다.
    var error = parseSupabaseError_(response.getContentText());
    logSupabaseError_(functionName, status, error.code, error.message);
    throw new Error('Supabase RPC(' + functionName + ') 응답 코드 ' + status + ' code=' + error.code);
  }
  return response.getContentText();
}

/**
 * PostgREST 오류 본문에서 code·message만 꺼낸다. Postgres 오류 메시지는 입력값을
 * 따옴표로 감싸 포함할 수 있으므로(예: invalid input syntax for type uuid: "...")
 * 따옴표 안 내용은 가린다.
 */
function parseSupabaseError_(body) {
  var parsed = {};
  try {
    parsed = JSON.parse(body) || {};
  } catch (err) {
    // JSON이 아니면 code·message 없음으로 처리
  }
  var message = String(parsed.message || 'n/a')
    .replace(/"[^"]*"/g, '"?"')
    .replace(/'[^']*'/g, "'?'")
    .slice(0, 300);
  return { code: String(parsed.code || 'n/a'), message: message };
}

function upsertSyncStatus_(accountId, status, errorMessage) {
  callSupabaseRpc_('upsert_sync_status', {
    p_account_id: accountId,
    p_status: status,
    p_error_message: errorMessage || null,
  });
}

function upsertSnapshot_(payload) {
  // 함수 시그니처가 upsert_snapshot(payload jsonb)이므로 본문을 인자 이름으로 감싼다.
  // 감싸지 않으면 PostgREST가 최상위 키(household_id/synced_at/accounts)를 인자
  // 이름으로 보고 함수를 찾지 못해 404(PGRST202)를 반환한다.
  var body = callSupabaseRpc_('upsert_snapshot', { payload: payload });

  // 판 종목 정리를 보호 규칙으로 건너뛴 계좌는 경고로 남긴다(종류와 payload 위치만).
  var result = {};
  try {
    result = JSON.parse(body) || {};
  } catch (err) {
    // 반환 본문이 없거나 JSON이 아니면 경고 없음으로 처리
  }
  var warnings = result.warnings || [];
  for (var i = 0; i < warnings.length; i++) {
    logPruneWarn_(warnings[i].account_idx, warnings[i].type);
  }
}

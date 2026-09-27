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
    // 응답 본문은 로그로 남기지 않는다(레코드/오류 상세가 섞여 있을 수 있음).
    throw new Error('Supabase RPC(' + functionName + ') 응답 코드 ' + status);
  }
  return response.getContentText();
}

function upsertSyncStatus_(accountId, status, errorMessage) {
  callSupabaseRpc_('upsert_sync_status', {
    p_account_id: accountId,
    p_status: status,
    p_error_message: errorMessage || null,
  });
}

function upsertSnapshot_(payload) {
  callSupabaseRpc_('upsert_snapshot', payload);
}

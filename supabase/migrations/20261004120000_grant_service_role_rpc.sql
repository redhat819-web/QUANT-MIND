-- QUANT-MIND: Apps Script(service role)가 동기화 RPC를 실행할 수 있도록 EXECUTE 권한 부여
--
-- 배경: upsert_snapshot/upsert_sync_status 생성 시 `revoke all ... from public`으로
-- PUBLIC 기본 EXECUTE를 회수하면서 service_role도 실행 권한을 잃었다(원격 DB에서
-- has_function_privilege('service_role', ..., 'execute') = false 확인). anon/
-- authenticated는 계속 실행 불가 — service_role에만 명시적으로 부여한다.

grant execute on function upsert_snapshot(jsonb) to service_role;
grant execute on function upsert_sync_status(uuid, text, text) to service_role;

-- PostgREST 스키마 캐시 갱신(함수 재정의/권한 변경 즉시 반영)
notify pgrst, 'reload schema';

-- QUANT-MIND: upsert_snapshot — 동기화 success 계좌에서 최신 스냅샷에 없는 종목(판 종목) 삭제
--
-- 기존에는 holding을 INSERT/UPDATE만 해서, 시트에서 사라진 종목이 DB에 계속 남았다.
-- 삭제 규칙:
-- - 대상: 이번 payload에서 sync_status='success'인 계좌의 holding 중 payload에
--   같은 raw_label이 없는 행. 같은 payload에 failed로도 온 계좌는 제외.
-- - 빈 스냅샷 보호: Board 예수금을 뺀 이번 스냅샷 종목이 0개면 삭제하지 않음
--   (PRUNE_SKIPPED_EMPTY).
-- - 대량 삭제 보호: 삭제 대상이 동기화 전 holding 수의 50% 이상이면 삭제하지 않음
--   (PRUNE_SKIPPED_LARGE).
-- 반환형이 void -> jsonb({"warnings":[{"type","account_idx"}]})로 바뀌므로
-- create or replace가 불가 — drop 후 재생성하고 권한을 다시 설정한다.

drop function upsert_snapshot(jsonb);

create function upsert_snapshot(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid := (payload->>'household_id')::uuid;
  v_synced_at timestamptz := (payload->>'synced_at')::timestamptz;
  v_account jsonb;
  v_holding jsonb;
  v_account_id uuid;
  v_owner_type text;
  v_owner_user_id uuid;
  v_owner_label text;
  v_sync_status text;
  v_sync_error text;
  v_classification text;
  v_security_key text;
  v_is_mapped boolean;
  v_account_idx bigint;
  v_success_ids uuid[] := '{}';
  v_failed_ids uuid[] := '{}';
  v_seen text[] := '{}';          -- '<account_id>|<raw_label>' (이번 스냅샷에 있는 종목)
  v_before_counts jsonb := '{}';  -- account_id -> 이번 동기화 전 holding 수
  v_account_idxs jsonb := '{}';   -- account_id -> payload accounts 배열 위치(1부터)
  v_prune_id uuid;
  v_before_count int;
  v_snapshot_count int;
  v_delete_count int;
  v_warnings jsonb := '[]';
begin
  for v_account, v_account_idx in
    select e.value, e.ord from jsonb_array_elements(payload->'accounts') with ordinality as e(value, ord)
  loop
    v_owner_type := v_account->>'owner_type';
    v_owner_user_id := nullif(v_account->>'owner_user_id', '')::uuid;
    v_owner_label := v_account->>'owner_label';
    v_sync_status := coalesce(v_account->>'sync_status', 'success');
    v_sync_error := v_account->>'sync_error';

    insert into account (
      household_id, owner_type, owner_user_id, owner_label, account_name,
      source_sheet_id, last_synced_at, last_sync_status, last_sync_error
    ) values (
      v_household_id, v_owner_type, v_owner_user_id, v_owner_label,
      v_account->>'account_name', v_account->>'source_sheet_id',
      case when v_sync_status = 'success' then v_synced_at else null end,
      v_sync_status, v_sync_error
    )
    on conflict (household_id, owner_type, coalesce(owner_user_id::text, ''), coalesce(owner_label, ''), account_name)
    do update set
      source_sheet_id = excluded.source_sheet_id,
      last_synced_at = case when v_sync_status = 'success' then v_synced_at else account.last_synced_at end,
      last_sync_status = v_sync_status,
      last_sync_error = v_sync_error,
      updated_at = now()
    returning id into v_account_id;

    if not v_account_idxs ? v_account_id::text then
      v_account_idxs := v_account_idxs || jsonb_build_object(v_account_id::text, v_account_idx);
    end if;

    if v_sync_status <> 'success' then
      v_failed_ids := v_failed_ids || v_account_id;
      continue;
    end if;
    v_success_ids := v_success_ids || v_account_id;

    -- 동기화 전 holding 수는 이 계좌의 첫 success 항목에서 한 번만 센다
    -- (upsert로 새로 생긴 행이 섞이기 전)
    if not v_before_counts ? v_account_id::text then
      v_before_counts := v_before_counts || jsonb_build_object(
        v_account_id::text, (select count(*) from holding where account_id = v_account_id));
    end if;

    for v_holding in select * from jsonb_array_elements(coalesce(v_account->'holdings', '[]'::jsonb))
    loop
      v_seen := v_seen || (v_account_id::text || '|' || (v_holding->>'raw_label'));
      v_classification := v_holding->>'classification';
      v_security_key := null;

      if v_classification is not null then
        v_is_mapped := true;
      else
        select mr.security_key into v_security_key
        from mapping_rule mr
        where mr.household_id = v_household_id
          and mr.owner_type = v_owner_type
          and coalesce(mr.owner_user_id::text, '') = coalesce(v_owner_user_id::text, '')
          and coalesce(mr.owner_label, '') = coalesce(v_owner_label, '')
          and mr.raw_label = v_holding->>'raw_label';

        v_is_mapped := v_security_key is not null;
        v_classification := 'unclassified';
      end if;

      insert into holding (
        account_id, security_key, display_name, quantity, market_value_krw,
        return_rate, classification, ticker, currency, average_cost,
        dividend, is_mapped, raw_label, cost_krw
      ) values (
        v_account_id, v_security_key,
        coalesce(v_holding->>'display_name', v_holding->>'raw_label'),
        (v_holding->>'quantity')::numeric, (v_holding->>'market_value_krw')::numeric,
        (v_holding->>'return_rate')::numeric, v_classification,
        v_holding->>'ticker', v_holding->>'currency',
        (v_holding->>'average_cost')::numeric, (v_holding->>'dividend')::numeric,
        v_is_mapped, v_holding->>'raw_label', (v_holding->>'cost_krw')::numeric
      )
      on conflict (account_id, raw_label) do update set
        security_key = excluded.security_key,
        display_name = excluded.display_name,
        quantity = excluded.quantity,
        market_value_krw = excluded.market_value_krw,
        return_rate = excluded.return_rate,
        ticker = excluded.ticker,
        currency = excluded.currency,
        average_cost = excluded.average_cost,
        dividend = excluded.dividend,
        is_mapped = excluded.is_mapped,
        cost_krw = excluded.cost_krw,
        classification = case
          when holding.classification_updated_by is null then excluded.classification
          else holding.classification
        end;
    end loop;
  end loop;

  -- 판 종목 정리: 이번 스냅샷에서 success인 계좌만. 같은 payload에서 한 번이라도
  -- failed로 온 계좌는 건드리지 않는다.
  for v_prune_id in
    select unnest(v_success_ids) except select unnest(v_failed_ids)
  loop
    select count(*) into v_delete_count
    from holding h
    where h.account_id = v_prune_id
      and not ((h.account_id::text || '|' || h.raw_label) = any(v_seen));

    if v_delete_count = 0 then
      continue;
    end if;

    -- 빈 스냅샷 보호: Board 예수금('예수금')을 뺀 종목이 0개면 시트 읽기 이상으로 보고
    -- 삭제하지 않는다.
    select count(*) into v_snapshot_count
    from unnest(v_seen) s
    where s like v_prune_id::text || '|%'
      and s <> v_prune_id::text || '|예수금';
    if v_snapshot_count = 0 then
      v_warnings := v_warnings || jsonb_build_object(
        'type', 'PRUNE_SKIPPED_EMPTY', 'account_idx', v_account_idxs->(v_prune_id::text));
      continue;
    end if;

    -- 대량 삭제 보호: 기존 종목의 50% 이상이 삭제 대상이면 삭제하지 않는다.
    v_before_count := (v_before_counts->>(v_prune_id::text))::int;
    if v_delete_count * 2 >= v_before_count then
      v_warnings := v_warnings || jsonb_build_object(
        'type', 'PRUNE_SKIPPED_LARGE', 'account_idx', v_account_idxs->(v_prune_id::text));
      continue;
    end if;

    delete from holding h
    where h.account_id = v_prune_id
      and not ((h.account_id::text || '|' || h.raw_label) = any(v_seen));
  end loop;

  -- 금액·이름 없이 경고 종류와 payload 위치만 돌려준다(Apps Script가 로그로 남김).
  return jsonb_build_object('warnings', v_warnings);
end;
$$;


revoke all on function upsert_snapshot(jsonb) from public;
revoke all on function upsert_snapshot(jsonb) from anon;
revoke all on function upsert_snapshot(jsonb) from authenticated;
grant execute on function upsert_snapshot(jsonb) to service_role;

notify pgrst, 'reload schema';

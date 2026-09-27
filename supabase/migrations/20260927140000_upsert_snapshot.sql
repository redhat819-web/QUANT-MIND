-- QUANT-MIND: upsert_snapshot RPC (T051 선행 조건)
--
-- Apps Script가 시트 스냅샷을 한 번의 RPC 호출로 반영하기 위한 함수. 기존
-- upsert_sync_status는 계정 하나의 상태만 가볍게 갱신하는 용도로 남기고,
-- 정상 동기화 시 계좌+보유종목 전체를 이 함수 하나로 원자적으로 반영한다.
--
-- payload 형태:
-- {
--   "household_id": "uuid",
--   "synced_at": "ISO 8601",
--   "accounts": [
--     {
--       "account_name": "string",
--       "owner_type": "member" | "joint" | "child",
--       "owner_user_id": "uuid | null",
--       "owner_label": "string | null",
--       "source_sheet_id": "string",
--       "sync_status": "success" | "failed",   -- 기본 success
--       "sync_error": "string | null",          -- 행 번호/오류 종류만, 금액·이름 금지
--       "holdings": [
--         {
--           "raw_label": "string",
--           "display_name": "string | null",     -- 없으면 raw_label 사용
--           "quantity": number,
--           "market_value_krw": number,
--           "return_rate": number,
--           "cost_krw": number | null,
--           "ticker": "string | null",
--           "currency": "string | null",
--           "average_cost": number | null,
--           "dividend": number | null,
--           "classification": "growth" | "defensive" | "cash" | null  -- null이면 mapping_rule 조회
--         }
--       ]
--     }
--   ]
-- }
--
-- 규칙:
-- - sync_status가 'failed'인 계정은 holdings를 반영하지 않고 계정 상태만
--   갱신한다. 이때 last_synced_at은 갱신하지 않고 마지막 성공 시점을 유지한다.
-- - classification이 payload에 이미 있으면(포트폴리오 탭의 자산분류처럼 시트가
--   이미 분류를 갖고 있는 경우) 그 값을 그대로 쓰고 is_mapped=true로 저장한다.
-- - classification이 없으면(배우자 주식처럼 시트에 분류가 없는 경우)
--   mapping_rule(household_id/owner_type/owner_user_id/owner_label/raw_label)을
--   조회해 security_key를 찾는다. 찾으면 is_mapped=true, 못 찾으면 is_mapped=false.
--   classification 자체는 mapping_rule에 없으므로 최초 생성 시 기본값 'growth'를
--   부여한다(미매핑 배지로 구분, 이후 FR-011에 따라 사용자가 수동 변경).
-- - 기존 보유 종목 UPDATE 시 classification 컬럼은 갱신 대상에서 제외한다
--   (FR-011 — 사용자가 수동으로 바꾼 분류를 재동기화가 덮어쓰지 않도록).

-- 자연키 기반 upsert를 위한 유니크 인덱스
create unique index account_natural_key_uidx on account (
  household_id,
  owner_type,
  coalesce(owner_user_id::text, ''),
  coalesce(owner_label, ''),
  account_name
);

create unique index holding_account_raw_label_uidx on holding (account_id, raw_label);

create or replace function upsert_snapshot(payload jsonb)
returns void
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
begin
  for v_account in select * from jsonb_array_elements(payload->'accounts')
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

    if v_sync_status <> 'success' then
      continue;
    end if;

    for v_holding in select * from jsonb_array_elements(coalesce(v_account->'holdings', '[]'::jsonb))
    loop
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
        v_classification := 'growth';
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
        cost_krw = excluded.cost_krw;
        -- classification은 의도적으로 SET 대상에서 제외(FR-011).
    end loop;
  end loop;
end;
$$;

-- Apps Script(service role key)만 호출한다. anon/authenticated 실행 권한 제거.
revoke all on function upsert_snapshot(jsonb) from public;
revoke all on function upsert_snapshot(jsonb) from anon;
revoke all on function upsert_snapshot(jsonb) from authenticated;

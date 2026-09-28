-- QUANT-MIND: 'unclassified'(미분류) 분류값 추가 + upsert_snapshot 기본값/갱신 규칙 정정
--
-- 배경: mapping_rule에 없는 종목(배우자 주식, 또는 포트폴리오 탭 자산분류 값이
-- CLASSIFICATION_MAP에 없는 경우)의 기본 분류가 지금까지 'growth'였다 — 실제로는
-- 분류를 모른다는 뜻이므로 'unclassified'로 바꾼다. 예수금 등 현금 항목은 계속
-- Apps Script가 명시적으로 'cash'를 보낸다(이 마이그레이션과 무관).

alter table holding drop constraint if exists holding_classification_check;
alter table holding add constraint holding_classification_check
  check (classification in ('growth', 'defensive', 'cash', 'unclassified'));

-- upsert_snapshot 재정의:
-- 1) mapping_rule에서 못 찾은 종목의 기본값을 'growth' -> 'unclassified'로 변경.
-- 2) 기존 보유 종목 UPDATE 시 classification_updated_by가 NULL인 행(=사람이 수동으로
--    바꾼 적 없는 행)만 최신 계산값(excluded.classification)으로 갱신한다. 즉:
--    - unclassified/기본값으로 남아있던 종목은 이후 mapping_rule이 생기거나 포트폴리오
--      탭 자산분류 값이 CLASSIFICATION_MAP에 매핑되면 다음 동기화에서 자동으로
--      새 분류로 갱신된다.
--    - classification_updated_by가 채워진 행(FR-011 수동 변경)은 재동기화가 절대
--      덮어쓰지 않는다 — 어떤 계산값이 나오든 기존 classification 유지.
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
end;
$$;

revoke all on function upsert_snapshot(jsonb) from public;
revoke all on function upsert_snapshot(jsonb) from anon;
revoke all on function upsert_snapshot(jsonb) from authenticated;

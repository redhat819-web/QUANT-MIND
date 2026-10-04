-- QUANT-MIND: 분류 규칙(classification_rule) + 종목 키(security_key) 자동 계산
--
-- 원칙: 분류 정본은 한 곳(지금은 시트 "종목분류" 탭). 동기화가 가구의 규칙을 탭
-- 내용으로 통째로 교체하고, 모든 holding을 매번 규칙으로 다시 분류한다.
-- - 키: 종목명이 "ABC1(설명)" 또는 공백 없는 영문대문자·숫자면 T:<티커>, 그 외는
--   N:<정규화 종목명>. holding(raw_label)과 탭 A열 모두 security_key_of() 하나로 계산.
-- - holding.sector: 본인 포트폴리오 "종목코드" 열(업종). 참고용, 분류에 쓰지 않음.
-- - is_mapped: 분류가 정해짐(규칙 일치 또는 payload 현금).
-- - 규칙 교체 보호: 유효 규칙 0개면 RULES_EMPTY_SKIPPED, 기존 규칙의 50% 미만이면
--   RULES_SHRINK_SKIPPED(기존 0개면 미적용) — 둘 다 기존 규칙 유지.
-- - classification_updated_by 예외(수동 변경 보존) 제거: 정본이 하나이므로.

alter table holding add column sector text;

create table classification_rule (
  household_id uuid not null references household(id) on delete cascade,
  security_key text not null,
  classification text not null check (classification in ('growth', 'defensive', 'cash')),
  source_row int,
  updated_at timestamptz not null default now(),
  primary key (household_id, security_key)
);

alter table classification_rule enable row level security;
create policy classification_rule_select on classification_rule
  for select to authenticated using (is_household_member(household_id));
grant select on classification_rule to authenticated;

create function security_key_of(label text)
returns text
language sql
immutable
as $$
  select case
    when m[1] is not null then 'T:' || m[1]
    else 'N:' || upper(regexp_replace(btrim(normalize(label, NFC)), '\s+', ' ', 'g'))
  end
  from (select regexp_match(btrim(label), '^([A-Z0-9]+)\s*(?:[(（].*[)）])?$') as m) x
$$;
revoke all on function security_key_of(text) from public;
revoke all on function security_key_of(text) from anon;

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
  v_rules jsonb := coalesce(payload->'classification_rules', '[]'::jsonb);
  v_rule_keys jsonb;
  v_rule_conflict_rows jsonb := '[]';
  v_new_rules int;
  v_existing_rules int;
begin
  -- 분류 규칙 교체: 시트 "종목분류" 탭이 정본이다. 규칙이 하나도 안 왔으면(탭 없음·
  -- 유효 행 0개) 기존 규칙을 그대로 둔다.
  if jsonb_array_length(v_rules) > 0 then
    select coalesce(jsonb_agg(jsonb_build_object(
             'k', security_key_of(e->>'label'),
             'c', e->>'classification',
             'row', (e->>'row')::int)), '[]')
      into v_rule_keys
      from jsonb_array_elements(v_rules) e;

    -- 같은 키에 서로 다른 분류가 오면 그 키는 건너뛰고 탭 행 번호만 돌려준다.
    select coalesce(jsonb_agg((x->>'row')::int order by (x->>'row')::int), '[]')
      into v_rule_conflict_rows
      from jsonb_array_elements(v_rule_keys) x
     where x->>'k' in (select y->>'k' from jsonb_array_elements(v_rule_keys) y
                        group by y->>'k' having count(distinct y->>'c') > 1);

    select count(*) into v_new_rules
      from (select y->>'k' from jsonb_array_elements(v_rule_keys) y
             group by y->>'k' having count(distinct y->>'c') = 1) z;
    select count(*) into v_existing_rules
      from classification_rule where household_id = v_household_id;

    if v_new_rules = 0 then
      v_warnings := v_warnings || jsonb_build_object('type', 'RULES_EMPTY_SKIPPED');
    elsif v_existing_rules > 0 and v_new_rules * 2 < v_existing_rules then
      -- 규칙 교체 보호: 유효 규칙이 기존의 50% 미만이면 탭 읽기 이상으로 보고 교체 안 함
      v_warnings := v_warnings || jsonb_build_object('type', 'RULES_SHRINK_SKIPPED');
    else
      delete from classification_rule where household_id = v_household_id;
      insert into classification_rule (household_id, security_key, classification, source_row)
      select v_household_id, y->>'k', min(y->>'c'), min((y->>'row')::int)
        from jsonb_array_elements(v_rule_keys) y
       group by y->>'k'
      having count(distinct y->>'c') = 1;
    end if;
  end if;

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
      -- 키: 사람별 별칭(mapping_rule)이 있으면 그 키, 없으면 종목명에서 계산(T:/N:)
      v_security_key := null;
      select mr.security_key into v_security_key
      from mapping_rule mr
      where mr.household_id = v_household_id
        and mr.owner_type = v_owner_type
        and coalesce(mr.owner_user_id::text, '') = coalesce(v_owner_user_id::text, '')
        and coalesce(mr.owner_label, '') = coalesce(v_owner_label, '')
        and mr.raw_label = v_holding->>'raw_label';
      v_security_key := coalesce(v_security_key, security_key_of(v_holding->>'raw_label'));

      -- 분류: payload가 현금으로 보낸 항목(Board 예수금·배우자 현금)은 cash, 그 외는
      -- classification_rule에서 찾고 없으면 unclassified. is_mapped = 분류가 정해짐.
      if v_holding->>'classification' = 'cash' then
        v_classification := 'cash';
        v_is_mapped := true;
      else
        v_classification := null;
        select cr.classification into v_classification
        from classification_rule cr
        where cr.household_id = v_household_id and cr.security_key = v_security_key;
        v_is_mapped := v_classification is not null;
        v_classification := coalesce(v_classification, 'unclassified');
      end if;

      insert into holding (
        account_id, security_key, display_name, quantity, market_value_krw,
        return_rate, classification, ticker, currency, average_cost,
        dividend, is_mapped, raw_label, cost_krw, sector
      ) values (
        v_account_id, v_security_key,
        coalesce(v_holding->>'display_name', v_holding->>'raw_label'),
        (v_holding->>'quantity')::numeric, (v_holding->>'market_value_krw')::numeric,
        (v_holding->>'return_rate')::numeric, v_classification,
        v_holding->>'ticker', v_holding->>'currency',
        (v_holding->>'average_cost')::numeric, (v_holding->>'dividend')::numeric,
        v_is_mapped, v_holding->>'raw_label', (v_holding->>'cost_krw')::numeric,
        v_holding->>'sector'
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
        sector = excluded.sector,
        -- 정본은 분류 규칙 하나뿐 — 매 동기화마다 계산값으로 덮어쓴다
        classification = excluded.classification;
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
  return jsonb_build_object(
    'warnings', v_warnings,
    'rule_conflict_rows', v_rule_conflict_rows,
    -- 어떤 holding과도 맞지 않는 규칙(오타 점검용) — 탭 행 번호만
    'rules_unmatched_rows', (
      select coalesce(jsonb_agg(cr.source_row order by cr.source_row), '[]')
      from classification_rule cr
      where cr.household_id = v_household_id
        and not exists (
          select 1 from holding h join account a on a.id = h.account_id
          where a.household_id = v_household_id and h.security_key = cr.security_key)));
end;
$$;



revoke all on function upsert_snapshot(jsonb) from public;
revoke all on function upsert_snapshot(jsonb) from anon;
revoke all on function upsert_snapshot(jsonb) from authenticated;
grant execute on function upsert_snapshot(jsonb) to service_role;

notify pgrst, 'reload schema';

-- QUANT-MIND Supabase schema (Phase 1 contract)
-- 이 파일은 data-model.md의 개념적 정의를 실제 실행 가능한 형태로 명세한다.
-- 실제 마이그레이션 파일은 supabase/migrations/에 이 내용을 기반으로 생성한다.

create extension if not exists "pgcrypto";

create table household (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

create table household_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  household_id uuid not null references household(id) on delete cascade,
  display_name text
);

create table account (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  owner_user_id uuid not null references household_members(user_id) on delete cascade,
  account_name text not null,
  source_sheet_id text,
  updated_at timestamptz not null default now(),
  last_synced_at timestamptz,
  last_sync_status text check (last_sync_status in ('success', 'failed')),
  last_sync_error text
);

-- 동기화 상태만 갱신하는 경량 RPC (시트 읽기/HTTP 호출 자체가 실패한 경우에도 호출)
create or replace function upsert_sync_status(
  p_account_id uuid,
  p_status text,
  p_error_message text default null
) returns void as $$
begin
  update account
  set last_sync_status = p_status,
      last_sync_error = p_error_message,
      last_synced_at = case when p_status = 'success' then now() else last_synced_at end
  where id = p_account_id;
end;
$$ language plpgsql security definer;

create table mapping_rule (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references household_members(user_id) on delete cascade,
  raw_label text not null,
  security_key text not null,
  created_at timestamptz not null default now(),
  unique (owner_user_id, raw_label)
);

create table holding (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references account(id) on delete cascade,
  security_key text,
  display_name text not null,
  quantity numeric not null,
  market_value_krw numeric not null,
  return_rate numeric not null,
  classification text not null check (classification in ('growth', 'defensive', 'cash')),
  classification_updated_by uuid references household_members(user_id),
  ticker text,
  currency text,
  average_cost numeric,
  dividend numeric,
  is_mapped boolean not null default false,
  raw_label text not null
);

create table agenda (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references household(id) on delete cascade,
  author_user_id uuid not null references household_members(user_id),
  title text not null check (char_length(btrim(title)) between 1 and 100),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  status text not null default 'discussing' check (status in ('discussing', 'agreed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table opinion (
  id uuid primary key default gen_random_uuid(),
  agenda_id uuid not null references agenda(id) on delete cascade,
  author_user_id uuid not null references household_members(user_id),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table agreement_record (
  id uuid primary key default gen_random_uuid(),
  agenda_id uuid not null unique references agenda(id) on delete cascade,
  confirmed_by_user_id uuid not null references household_members(user_id),
  confirmed_at timestamptz not null default now(),
  opinion_count_at_confirmation int not null default 0
);

create table agenda_history (
  id uuid primary key default gen_random_uuid(),
  agenda_id uuid not null references agenda(id) on delete cascade,
  changed_by_user_id uuid not null references household_members(user_id),
  changed_at timestamptz not null default now(),
  reason text not null,
  previous_title text,
  previous_body text
);

-- 트리거: agenda가 'agreed'인 상태에서 UPDATE 발생 시, 새 값을 덮어쓰기 전에
-- agenda_history에 이전 값을 append한다. (헌장 원칙 VIII)
create or replace function fn_preserve_agenda_history()
returns trigger as $$
begin
  if old.status = 'agreed' and (new.title is distinct from old.title or new.body is distinct from old.body) then
    insert into agenda_history (agenda_id, changed_by_user_id, reason, previous_title, previous_body)
    values (old.id, auth.uid(), coalesce(current_setting('request.jwt.claims.change_reason', true), '사유 미기재'), old.title, old.body);
  end if;
  new.updated_at := now();
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_agenda_history
before update on agenda
for each row execute function fn_preserve_agenda_history();

-- 트리거: agreement_record가 생성되면 agenda.status를 'agreed'로 전환
create or replace function fn_confirm_agenda()
returns trigger as $$
begin
  update agenda set status = 'agreed', updated_at = now() where id = new.agenda_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_confirm_agenda
after insert on agreement_record
for each row execute function fn_confirm_agenda();

-- 개인 통합 뷰 (계좌 → 개인 합산, 평가금액 가중 평균 수익률)
create view personal_aggregate_view as
select
  a.owner_user_id,
  a.household_id,
  sum(h.market_value_krw) as total_market_value_krw,
  sum(h.market_value_krw * h.return_rate) / nullif(sum(h.market_value_krw), 0) as weighted_return_rate,
  min(a.last_synced_at) as as_of_synced_at,
  bool_or(a.last_sync_status = 'failed') as has_sync_failure
from account a
join holding h on h.account_id = a.id
group by a.owner_user_id, a.household_id;

-- 부부 통합 뷰 (개인 통합 → 재집계)
create view household_aggregate_view as
select
  household_id,
  sum(total_market_value_krw) as total_market_value_krw,
  sum(total_market_value_krw * weighted_return_rate) / nullif(sum(total_market_value_krw), 0) as weighted_return_rate,
  min(as_of_synced_at) as as_of_synced_at,
  bool_or(has_sync_failure) as has_sync_failure
from personal_aggregate_view
group by household_id;

-- 성장/방어/현금 비중 뷰
create view allocation_view as
select
  a.household_id,
  h.classification,
  sum(h.market_value_krw) as classification_market_value_krw,
  sum(h.market_value_krw) / nullif(sum(sum(h.market_value_krw)) over (partition by a.household_id), 0) as weight_ratio
from account a
join holding h on h.account_id = a.id
group by a.household_id, h.classification;

-- 공개 화면 대비 뷰 (구현은 이번 범위 아님, 스키마만 선반영) — 금액 컬럼 없음
create view public_allocation_view as
select
  household_id,
  classification,
  weight_ratio
from allocation_view;

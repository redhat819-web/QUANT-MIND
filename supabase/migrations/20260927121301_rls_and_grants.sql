-- QUANT-MIND RLS policies + role grants (T050)
-- Based on specs/001-quant-mind-dashboard/contracts/rls-policies.sql, plus
-- explicit table/view/function grants: anon gets nothing, authenticated gets
-- exactly the operations its RLS policies allow. service_role bypasses RLS
-- as usual and needs no explicit grant here (Apps Script uses it directly).

create or replace function is_household_member(target_household_id uuid)
returns boolean as $$
  select exists (
    select 1 from household_members
    where user_id = auth.uid()
      and household_id = target_household_id
  );
$$ language sql stable security definer set search_path = public;

alter table household enable row level security;
alter table household_members enable row level security;
alter table account enable row level security;
alter table holding enable row level security;
alter table mapping_rule enable row level security;
alter table agenda enable row level security;
alter table opinion enable row level security;
alter table agreement_record enable row level security;
alter table agenda_history enable row level security;

-- household / household_members: 본인이 속한 household만 조회
create policy household_select on household
  for select using (is_household_member(id));

create policy household_members_select on household_members
  for select using (is_household_member(household_id));

-- account: household 구성원이면 소유자 무관하게 조회 가능(FR-003)
create policy account_select on account
  for select using (is_household_member(household_id));

create policy account_insert on account
  for insert with check (is_household_member(household_id) and owner_user_id = auth.uid());

-- holding: account를 통해 household 스코프 판단
create policy holding_select on holding
  for select using (
    exists (
      select 1 from account a
      where a.id = holding.account_id
        and is_household_member(a.household_id)
    )
  );

-- 분류(classification)만 수동 변경 허용 (FR-011). 다른 컬럼은 Apps Script(service role)만 갱신.
create policy holding_update_classification on holding
  for update using (
    exists (
      select 1 from account a
      where a.id = holding.account_id
        and is_household_member(a.household_id)
    )
  )
  with check (
    exists (
      select 1 from account a
      where a.id = holding.account_id
        and is_household_member(a.household_id)
    )
  );

-- mapping_rule: household 구성원이면 조회/등록 가능(미매핑 종목 수동 매핑, FR-015)
create policy mapping_rule_select on mapping_rule
  for select using (
    exists (
      select 1 from household_members hm
      where hm.user_id = mapping_rule.owner_user_id
        and is_household_member(hm.household_id)
    )
  );

create policy mapping_rule_insert on mapping_rule
  for insert with check (
    exists (
      select 1 from household_members hm
      where hm.user_id = mapping_rule.owner_user_id
        and is_household_member(hm.household_id)
    )
  );

-- agenda: household 구성원 누구나 조회, 작성은 본인 명의로만
create policy agenda_select on agenda
  for select using (is_household_member(household_id));

create policy agenda_insert on agenda
  for insert with check (is_household_member(household_id) and author_user_id = auth.uid());

-- 수정은 "논의중" 상태 + 작성자 본인만 (FR-016a). 'agreed' 이후는 트리거가 이력으로 흡수.
create policy agenda_update on agenda
  for update using (
    is_household_member(household_id)
    and author_user_id = auth.uid()
    and status = 'discussing'
  );

-- opinion: household 구성원 누구나 조회/작성 가능 (수정·삭제 정책 없음 = 불가)
create policy opinion_select on opinion
  for select using (
    exists (
      select 1 from agenda ag
      where ag.id = opinion.agenda_id
        and is_household_member(ag.household_id)
    )
  );

create policy opinion_insert on opinion
  for insert with check (
    author_user_id = auth.uid()
    and exists (
      select 1 from agenda ag
      where ag.id = opinion.agenda_id
        and is_household_member(ag.household_id)
    )
  );

-- agreement_record: household 구성원 누구나 확정 가능 (동등 권한, 의견 0건도 허용 FR-019)
create policy agreement_record_select on agreement_record
  for select using (
    exists (
      select 1 from agenda ag
      where ag.id = agreement_record.agenda_id
        and is_household_member(ag.household_id)
    )
  );

create policy agreement_record_insert on agreement_record
  for insert with check (
    confirmed_by_user_id = auth.uid()
    and exists (
      select 1 from agenda ag
      where ag.id = agreement_record.agenda_id
        and is_household_member(ag.household_id)
        and ag.status = 'discussing'
    )
  );

-- agenda_history: 조회만 허용, INSERT/UPDATE/DELETE 정책 없음(트리거의 security definer 함수만 기록 가능)
create policy agenda_history_select on agenda_history
  for select using (
    exists (
      select 1 from agenda ag
      where ag.id = agenda_history.agenda_id
        and is_household_member(ag.household_id)
    )
  );

-- 공개 화면 대비 뷰(public_allocation_view)는 이번 범위에서 RLS/anon 정책을 활성화하지
-- 않는다(구현 자체가 범위 외). 향후 공개 화면 구현 시 household_id 없이 전체 요약만
-- 노출하는 별도 정책을 추가해야 한다.

-- ---------------------------------------------------------------------------
-- 역할별 GRANT: anon에는 아무 권한도 주지 않고, authenticated에만 RLS 정책이
-- 허용하는 오퍼레이션만 명시적으로 GRANT한다.
-- ---------------------------------------------------------------------------

revoke all on schema public from anon;
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;

grant usage on schema public to authenticated;

grant select on household to authenticated;
grant select on household_members to authenticated;
grant select, insert on account to authenticated;
grant select, update on holding to authenticated;
grant select, insert on mapping_rule to authenticated;
grant select, insert, update on agenda to authenticated;
grant select, insert on opinion to authenticated;
grant select, insert on agreement_record to authenticated;
grant select on agenda_history to authenticated;

grant select on personal_aggregate_view to authenticated;
grant select on household_aggregate_view to authenticated;
grant select on allocation_view to authenticated;
grant select on public_allocation_view to authenticated;

-- is_household_member는 RLS 정책 내부에서 authenticated 요청 시 호출되므로 실행 권한 필요.
revoke all on function is_household_member(uuid) from public;
grant execute on function is_household_member(uuid) to authenticated;

-- upsert_sync_status는 Apps Script가 service role key로만 호출한다.
-- anon/authenticated 모두에게서 실행 권한을 제거한다(service_role은 RLS/GRANT를
-- 우회하므로 별도 GRANT가 필요 없다).
revoke all on function upsert_sync_status(uuid, text, text) from public;
revoke all on function upsert_sync_status(uuid, text, text) from anon;
revoke all on function upsert_sync_status(uuid, text, text) from authenticated;

-- 트리거 전용 함수는 트리거 메커니즘이 호출하므로 별도 역할 GRANT가 필요 없다.
revoke all on function fn_preserve_agenda_history() from public;
revoke all on function fn_confirm_agenda() from public;

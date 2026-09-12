-- QUANT-MIND RLS policies (Phase 1 contract)
-- 원칙: 관리자/역할 개념 없이 "요청자가 같은 household 소속인가"만으로 판단한다.
-- (헌장 원칙 I: 동등한 운영자 권한)

create or replace function is_household_member(target_household_id uuid)
returns boolean as $$
  select exists (
    select 1 from household_members
    where user_id = auth.uid()
      and household_id = target_household_id
  );
$$ language sql stable security definer;

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

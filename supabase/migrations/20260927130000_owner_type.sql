-- QUANT-MIND: 소유자 유형(member/joint/child) + 원화 매입원가 기반 수익률
--
-- 배경
-- 1) 자녀·공동 계좌는 auth.users로 로그인하지 않으므로 household_members에
--    행이 없다. account.owner_user_id(not null)로는 표현할 수 없어
--    owner_type을 추가하고 owner_user_id를 nullable로 바꾼다.
--    "나/배우자"는 로그인한 사람(auth.uid())과 owner_user_id를 프런트에서
--    비교해 화면에 표시하는 값일 뿐이므로 DB에는 저장하지 않는다 — DB에는
--    member(개인 명의) / joint(공동 명의) / child(자녀 명의)만 구분한다.
-- 2) 수익률(weighted_return_rate)은 C7 결정에 따라
--      (Σ평가금액 − Σ매입원가) ÷ Σ매입원가
--    로 계산한다. 매입원가는 average_cost(평균 단가) × quantity로 재계산하지
--    않고, 시트에서 원화로 이미 합산된 값을 holding.cost_krw에 그대로
--    저장해 사용한다(해외 종목의 통화 혼합 오류 방지). cost_krw가 없는
--    종목은 분자·분모 모두에서 제외하되, total_market_value_krw(평가금액
--    합계)에는 그대로 포함한다.
-- 3) mapping_rule도 동일한 이유로 household_id 기반 스코프로 전환한다.
--    household/allocation 집계 뷰는 owner_type='child'만 제외한다(joint은
--    포함). personal_aggregate_view는 child를 포함해 개인 단위로 노출한다.

-- ---------------------------------------------------------------------------
-- 0. holding: 원화 매입원가 합계 컬럼 추가
-- ---------------------------------------------------------------------------

alter table holding
  add column cost_krw numeric;

-- ---------------------------------------------------------------------------
-- 1. account: owner_type / owner_label 추가, owner_user_id nullable화
-- ---------------------------------------------------------------------------

alter table account
  add column owner_type text not null default 'member'
    check (owner_type in ('member', 'joint', 'child')),
  add column owner_label text;

alter table account
  alter column owner_user_id drop not null;

alter table account
  add constraint account_owner_user_id_matches_owner_type
  check (
    (owner_type = 'member' and owner_user_id is not null)
    or (owner_type in ('joint', 'child') and owner_user_id is null)
  );

alter table account
  add constraint account_owner_label_required_iff_child
  check (
    (owner_type = 'child') = (owner_label is not null and btrim(owner_label) <> '')
  );

-- 기존 정책은 "본인 명의로만 INSERT"만 허용했다. joint/child 계좌는 소유자 본인
-- 계정이 없거나(child) 특정 1인 명의가 아니므로(joint), household 구성원 누구나
-- 등록할 수 있게 하되 member는 여전히 본인 명의로만 등록 가능하다.
drop policy account_insert on account;

create policy account_insert on account
  for insert with check (
    is_household_member(household_id)
    and (
      (owner_type = 'member' and owner_user_id = auth.uid())
      or (owner_type in ('joint', 'child') and owner_user_id is null)
    )
  );

-- account_select는 owner_type과 무관하게 household_id 멤버십만으로 판단하므로
-- (T050에서 이미 그렇게 작성됨) joint/child 계좌도 같은 household 구성원이면
-- 그대로 조회 가능하다 — 변경 불필요, 재확인만.

-- ---------------------------------------------------------------------------
-- 2. mapping_rule: household_id 기반으로 전환(joint/child 종목도 매핑 가능)
-- ---------------------------------------------------------------------------

alter table mapping_rule
  add column household_id uuid references household(id) on delete cascade,
  add column owner_type text not null default 'member'
    check (owner_type in ('member', 'joint', 'child')),
  add column owner_label text;

-- 기존 행은 owner_user_id로부터 household_id를 채운다(이번 배포 시점엔 데이터 없음).
update mapping_rule mr
set household_id = hm.household_id
from household_members hm
where hm.user_id = mr.owner_user_id
  and mr.household_id is null;

alter table mapping_rule
  alter column household_id set not null;

alter table mapping_rule
  alter column owner_user_id drop not null;

alter table mapping_rule
  add constraint mapping_rule_owner_user_id_matches_owner_type
  check (
    (owner_type = 'member' and owner_user_id is not null)
    or (owner_type in ('joint', 'child') and owner_user_id is null)
  );

alter table mapping_rule
  add constraint mapping_rule_owner_label_required_iff_child
  check (
    (owner_type = 'child') = (owner_label is not null and btrim(owner_label) <> '')
  );

alter table mapping_rule drop constraint mapping_rule_owner_user_id_raw_label_key;

create unique index mapping_rule_owner_raw_label_uidx on mapping_rule (
  household_id,
  owner_type,
  coalesce(owner_user_id::text, ''),
  coalesce(owner_label, ''),
  raw_label
);

-- household_id 기반 RLS로 전환(joint/child에는 household_members 조인이 아예
-- 성립하지 않으므로 owner_user_id 경유 정책은 쓸 수 없다).
drop policy mapping_rule_select on mapping_rule;
drop policy mapping_rule_insert on mapping_rule;

create policy mapping_rule_select on mapping_rule
  for select using (is_household_member(household_id));

create policy mapping_rule_insert on mapping_rule
  for insert with check (is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- 3. 집계 뷰 재정의: household/allocation은 child만 제외(joint 포함),
--    personal은 child 포함. 수익률은 cost_krw 기준으로 재계산.
--    (뷰 컬럼이 바뀌므로 의존 순서대로 drop 후 재생성)
-- ---------------------------------------------------------------------------

drop view public_allocation_view;
drop view allocation_view;
drop view household_aggregate_view;
drop view personal_aggregate_view;

-- 개인 통합 뷰: child 포함. child/joint는 auth 사용자가 아니므로 owner_user_id가
-- null이며, owner_type(+child의 owner_label)로 사람을 구분한다.
create view personal_aggregate_view
with (security_invoker = true) as
select
  a.household_id,
  a.owner_type,
  a.owner_user_id,
  a.owner_label,
  sum(h.market_value_krw) as total_market_value_krw,
  (
    sum(h.market_value_krw) filter (where h.cost_krw is not null)
    - sum(h.cost_krw) filter (where h.cost_krw is not null)
  ) / nullif(sum(h.cost_krw) filter (where h.cost_krw is not null), 0)
    as weighted_return_rate,
  min(a.last_synced_at) as as_of_synced_at,
  bool_or(a.last_sync_status = 'failed') as has_sync_failure
from account a
join holding h on h.account_id = a.id
group by a.household_id, a.owner_type, a.owner_user_id, a.owner_label;

-- 부부 통합 뷰: child 계좌만 제외(joint은 포함)
create view household_aggregate_view
with (security_invoker = true) as
select
  a.household_id,
  sum(h.market_value_krw) as total_market_value_krw,
  (
    sum(h.market_value_krw) filter (where h.cost_krw is not null)
    - sum(h.cost_krw) filter (where h.cost_krw is not null)
  ) / nullif(sum(h.cost_krw) filter (where h.cost_krw is not null), 0)
    as weighted_return_rate,
  min(a.last_synced_at) as as_of_synced_at,
  bool_or(a.last_sync_status = 'failed') as has_sync_failure
from account a
join holding h on h.account_id = a.id
where a.owner_type <> 'child'
group by a.household_id;

-- 성장/방어/현금 비중 뷰: child 계좌만 제외(수익률 계산 없음, 변경 없음)
create view allocation_view
with (security_invoker = true) as
select
  a.household_id,
  h.classification,
  sum(h.market_value_krw) as classification_market_value_krw,
  sum(h.market_value_krw) / nullif(sum(sum(h.market_value_krw)) over (partition by a.household_id), 0) as weight_ratio
from account a
join holding h on h.account_id = a.id
where a.owner_type <> 'child'
group by a.household_id, h.classification;

create view public_allocation_view
with (security_invoker = true) as
select
  household_id,
  classification,
  weight_ratio
from allocation_view;

-- ---------------------------------------------------------------------------
-- 4. GRANT 재적용 (뷰를 drop/create했으므로 authenticated 권한 다시 부여)
-- ---------------------------------------------------------------------------

grant select on personal_aggregate_view to authenticated;
grant select on household_aggregate_view to authenticated;
grant select on allocation_view to authenticated;
grant select on public_allocation_view to authenticated;

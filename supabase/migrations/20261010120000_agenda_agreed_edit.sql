-- 판단 로그 Supabase 연결(T060~T063) 전 스키마·RLS 보정
--
-- 1. 합의완료 안건 수정(FR-021, spec US3 Acceptance 5): 기존 agenda_update 정책은
--    status = 'discussing'만 허용해 합의완료 안건은 수정할 길이 없었고, 이력 트리거의
--    agreed 분기는 실행될 수 없었다. 합의완료 안건은 household 구성원 누구나(FR-003
--    동등 권한) 수정할 수 있게 하되, 사유가 없으면 DB가 거부한다.
-- 2. 수정 사유: 트리거가 읽던 request.jwt.claims.change_reason은 클라이언트가 넣을 수
--    없어 항상 '사유 미기재'였다. edit_agreed_agenda RPC가 트랜잭션 로컬 설정
--    quantmind.change_reason에 사유를 넣고, 트리거는 그 값을 읽는다.
-- 3. 수정 가능한 컬럼을 title/body로 제한한다. status 전환은 fn_confirm_agenda
--    (security definer)만 한다.
-- 4. opinion_count_at_confirmation은 클라이언트 값 대신 DB가 확정 시점에 센다(FR-019).

-- 1. 합의완료 안건 수정 정책 (논의중 안건은 기존 agenda_update: 작성자 본인만)
create policy agenda_update_agreed on agenda
  for update
  using (is_household_member(household_id) and status = 'agreed')
  with check (is_household_member(household_id) and status = 'agreed');

-- 2. 이력 트리거: 합의완료 안건의 제목/내용 변경은 사유가 있어야 하고 이전 값을 남긴다
create or replace function fn_preserve_agenda_history()
returns trigger as $$
declare
  change_reason text := nullif(btrim(coalesce(current_setting('quantmind.change_reason', true), '')), '');
begin
  if old.status = 'agreed' and (new.title is distinct from old.title or new.body is distinct from old.body) then
    if change_reason is null then
      raise exception 'agreed agenda edit requires a change reason'
        using errcode = 'P0001', hint = 'edit_agreed_agenda';
    end if;
    insert into agenda_history (agenda_id, changed_by_user_id, reason, previous_title, previous_body)
    values (old.id, auth.uid(), change_reason, old.title, old.body);
  end if;
  new.updated_at := now();
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- 합의완료 안건 수정 RPC. security invoker라 RLS(agenda_update_agreed)가 그대로 적용된다.
create or replace function edit_agreed_agenda(
  p_agenda_id uuid,
  p_title text,
  p_body text,
  p_reason text
)
returns agenda as $$
declare
  updated agenda;
begin
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 500 then
    raise exception 'change reason must be 1-500 characters'
      using errcode = '22023';
  end if;
  perform set_config('quantmind.change_reason', btrim(p_reason), true);
  update agenda
     set title = p_title, body = p_body
   where id = p_agenda_id and status = 'agreed'
  returning * into updated;
  if updated.id is null then
    raise exception 'agreed agenda not found or not permitted'
      using errcode = 'P0002';
  end if;
  return updated;
end;
$$ language plpgsql security invoker set search_path = public;

revoke all on function edit_agreed_agenda(uuid, text, text, text) from public;
revoke all on function edit_agreed_agenda(uuid, text, text, text) from anon;
grant execute on function edit_agreed_agenda(uuid, text, text, text) to authenticated;

-- 3. 클라이언트가 바꿀 수 있는 컬럼은 title/body뿐
revoke update on agenda from authenticated;
grant update (title, body) on agenda to authenticated;

-- 4. 확정 시점 의견 수는 DB가 센다
create or replace function fn_count_opinions_at_confirmation()
returns trigger as $$
begin
  new.opinion_count_at_confirmation := (
    select count(*) from opinion where agenda_id = new.agenda_id
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function fn_count_opinions_at_confirmation() from public;

create trigger trg_count_opinions_at_confirmation
before insert on agreement_record
for each row execute function fn_count_opinions_at_confirmation();

# Quickstart: QUANT-MIND 공동 자산 관리 대시보드

이 문서는 구현 순서(Mock 우선 → design-sync → Sheets 어댑터 → Supabase 협업
기능)에 따라 각 단계를 어떻게 실행/검증하는지 안내한다. 세부 구현 코드는
tasks.md와 실제 소스에 있으며, 여기서는 실행 가능한 검증 절차만 다룬다.

## 0. 로컬 실행 방법 (§16)

```bash
# 최초 1회
npm install
cp .env.example .env.local   # VITE_DATA_SOURCE=mock 로 시작

# Mock 모드 개발 서버
npm run dev                  # http://localhost:5173/QUANT-MIND/

# 단위/컴포넌트 테스트
npm run test                 # vitest

# E2E (데스크톱 + 모바일 뷰포트)
npm run test:e2e             # playwright

# 실제 Supabase 통합 테스트(환경변수 필요, §4.5)
npm run test:integration

# 빌드(헌장 원칙 XVII 게이트 — 실패 시 완료 처리 금지)
npm run build
```

`.env.local` 예시:

```env
VITE_DATA_SOURCE=mock            # mock | supabase
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Supabase 프로젝트가 준비되면 `VITE_DATA_SOURCE=supabase`로 전환하고
`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`를 채운다(anon key만 프런트에 노출,
service role key는 절대 프런트/레포에 두지 않음 — 헌장 원칙 IV).

## 1. Mock Data 기반 UI 우선 구현 검증 (§14)

**목표**: Supabase/Sheets 연동 전에 세 핵심 화면이 독립적으로 동작함을 증명한다.

1. `src/mocks/fixtures/`에 아래 케이스를 포함한 고정 데이터를 둔다:
   - 정상 케이스: 두 운영자 각각 계좌 2개 이상, 조건부 항목 일부 존재.
   - 조건부 항목 전부 null인 종목 1개 이상(SC-003 검증용).
   - 미매핑 종목(`is_mapped=false`) 1개 이상(FR-015 검증용).
   - 논의중 안건 1개(의견 0건), 합의완료 안건 1개(의견 2개 이상 + agreement_record).
2. `npm run dev`(mock 모드)로 실행 후 수동으로 아래를 확인:
   - 대시보드: 나의 개인 통합, 상대방의 개인 통합, 부부 통합이 각각 표시되는가
     (User Story 1 Acceptance 1~3).
   - 계좌·종목 리스트: 빠른 확인 모드 → 상세 모드 전환, 분류 변경 시 대시보드
     비중에 반영되는가(User Story 2).
   - 판단 로그: 안건 작성 → 의견 작성 → 합의 확정 → 재조회 흐름(User Story 3).
3. `npm run test:e2e -- --grep mock`으로 위 시나리오를 Playwright + MSW 조합으로
   자동화해 통과시킨다.
4. 이 단계가 통과하기 전까지는 §2(design-sync)로 넘어가지 않는다.

## 2. `/design-sync` 실행 (§15)

**시점**: §1의 Mock 기반 세 화면이 로컬에서 정상 동작함을 확인한 직후, Sheets
어댑터 작업(§3) 시작 전.

**범위**: 세 화면의 정보 구조/컴포넌트 일관성(헌장 원칙 XII), 상태 배지의
색상+텍스트 이중 표현(원칙 XIII), `prefers-reduced-motion` 대응(원칙 XIV)만
점검한다. 데이터 연동 로직은 이 단계의 점검 대상이 아니다.

```text
/design-sync
```

design-sync 결과 지적 사항은 이 단계에서 즉시 반영하고, 통과 후에만 §3으로
진행한다.

## 3. Sheets 어댑터(U5) 연동 검증

1. Supabase 프로젝트에 `contracts/supabase-schema.sql` + `contracts/rls-policies.sql`
   적용.
2. `apps-script/` 프로젝트를 테스트용 스프레드시트(사본)에 연결하고, service role
   key를 스크립트 속성에 등록.
3. 수동 동기화 메뉴 실행 → Supabase `account`/`holding` 테이블에 값이 반영되는지
   확인. 이때:
   - 조건부 항목이 비어 있는 시트 행이 null로 정상 저장되는지(FR-013) 확인.
   - 동일 종목의 표기가 다른 두 사람 데이터를 각각 넣고, `mapping_rule`에 규칙을
     하나만 등록한 뒤, 규칙이 없는 쪽이 `is_mapped=false`로 노출되는지(FR-015)
     확인.
4. `VITE_DATA_SOURCE=supabase`로 전환한 프런트에서 대시보드가 §1의 mock 검증과
   동일한 화면 구조로 나타나는지 확인(개인 통합/부부 통합 3단계 구조, 헌장 원칙
   XII의 일관성 유지 여부 재확인).

## 4. Supabase 협업 기능(U4) 연동 검증 (T065)

실제 Supabase(연결된 프로젝트)에서 두 구성원 계정으로 판단 로그 규칙을 확인한다.
약 20~30분.

> 점검 데이터는 실제 판단 로그에 쌓인다(앱에 삭제 기능 없음). 제목은 모두
> `[점검]`으로 시작하게 하고, 마지막 4.6에서 SQL로 정리한다.

### 4.0 준비

1. `.env.local`을 `VITE_DATA_SOURCE=supabase`로 바꾸고 `npm run dev` →
   http://localhost:5173/QUANT-MIND/
2. 창 A(일반 창)는 구성원 A, 창 B(시크릿 창)는 구성원 B로 로그인한다. 세션이
   브라우저별로 저장되므로 창을 나눠야 한다.
3. 점검이 끝나면 `VITE_DATA_SOURCE=mock`으로 되돌린다.

### 4.1 작성·수정 권한·의견 (FR-003, FR-016a, FR-022)

| # | 창 | 할 일 | 기대 결과 |
|---|---|---|---|
| 1-1 | A | [안건 작성] → 제목 `[점검] 권한 확인` 저장 | 목록에 **논의중**, 작성자 이름·현재 시각 표시("나"로 보이면 `display_name`이 비어 있음) |
| 1-2 | B | 새로고침 → 그 안건 선택 | 내용은 보이고 **[수정 저장] 폼은 없음** |
| 1-3 | B | 의견 "B 의견" 등록 | B 이름·시각과 함께 표시 |
| 1-4 | A | 새로고침 → 같은 안건 | B 의견이 보이고 [수정 저장] 폼이 있음. 제목을 바꿔 저장하면 반영 |
| 1-5 | A | 대시보드 | "논의 중인 안건"에 `[점검] 권한 확인`이 있음 |

### 4.2 의견 0건 확정·중복 확정 차단 (FR-019)

| # | 창 | 할 일 | 기대 결과 |
|---|---|---|---|
| 2-1 | A | 새 안건 `[점검] 의견 0건 확정` 작성 → 바로 [합의 확정] | **합의완료**, "확정 시점 의견 **0건**" |
| 2-2 | A | `[점검] 권한 확인`(의견 1건) → [합의 확정] | "확정 시점 의견 **1건**"(DB가 센 값) |
| 2-3 | B | **새로고침하지 않은 채** `[점검] 권한 확인`에서 [합의 확정] | "이미 합의가 확정된" 또는 "상태가 바뀌었습니다" 문구. 이미 새로고침돼 버튼이 비활성이면 그것도 통과 |

### 4.3 합의완료 안건의 사유 있는 수정·변경 이력 (FR-021)

| # | 창 | 할 일 | 기대 결과 |
|---|---|---|---|
| 3-1 | B | `[점검] 권한 확인`(합의완료, 작성자 A) 선택 | [합의 내용 수정] 버튼이 보임(작성자가 아니어도 수정 가능) |
| 3-2 | B | [합의 내용 수정] → 제목 변경 → 사유 비움 → [이력 남기고 수정] | 사유 입력 오류, **저장 안 됨** |
| 3-3 | B | 사유 "점검 사유" 입력 → [이력 남기고 수정] | 폼이 닫히고 제목이 바뀜. **변경 이력**에 B·시각·"사유: 점검 사유", "이전 내용 보기"에 이전 제목·내용 |
| 3-4 | A | 새로고침 → 같은 안건 | 같은 이력이 보임 |

SQL로 확인(Supabase 대시보드 → SQL Editor):

```sql
select a.title, a.status, h.reason, h.previous_title, m.display_name as changed_by, h.changed_at
from agenda a
join agenda_history h on h.agenda_id = a.id
left join household_members m on m.user_id = h.changed_by_user_id
where a.title like '[점검]%';
```

기대: 1행, `reason = '점검 사유'`, `previous_title`이 이전 제목, `changed_by`가 B.

### 4.4 비로그인 접근 차단 (FR-002, FR-004, 헌장 원칙 II)

```bash
set -a; . ./.env.local; set +a
curl -s "$VITE_SUPABASE_URL/rest/v1/agenda?select=id" -H "apikey: $VITE_SUPABASE_ANON_KEY"
curl -s "$VITE_SUPABASE_URL/rest/v1/household_aggregate_view?select=*" -H "apikey: $VITE_SUPABASE_ANON_KEY"
```

기대: 둘 다 `permission denied`(`42501`), 데이터 없음. 브라우저에서 로그아웃
상태로 `/judgment-log`에 들어가면 로그인 화면으로 이동한다.

### 4.5 구성원 규칙 자동 검증(선택, T064)

테스트 전용 household 계정이 있을 때만 실행한다(테스트 안건은 지울 수 없음).

```bash
QM_IT_SUPABASE_URL=... QM_IT_SUPABASE_ANON_KEY=... \
QM_IT_MEMBER_A_EMAIL=... QM_IT_MEMBER_A_PASSWORD=... \
QM_IT_MEMBER_B_EMAIL=... QM_IT_MEMBER_B_PASSWORD=... \
npm run test:integration
```

환경변수가 없으면 모든 케이스를 건너뛴다.

### 4.6 점검 데이터 정리

```sql
-- 의견·합의 기록·변경 이력도 함께 삭제된다(on delete cascade)
delete from agenda where title like '[점검]%' returning id, title;
```

실행 전에 실제 안건 중 `[점검]`으로 시작하는 제목이 없는지 확인한다.

### 4.7 결과 기록

- 모두 통과: tasks.md T060~T065를 `[X]`로 바꾸고 점검 날짜를 남긴다.
- 실패: 단계 번호와 화면 문구(또는 SQL 결과)를 남긴다.

> 실제 Supabase 대상 Playwright E2E는 이 절차에서 뺐다(2026-10-10). 현재 E2E는
> mock 로그인(`loginAsMockUser`)과 mock 안건 제목에 의존해 실데이터로는 돌릴 수
> 없다. 실계정용 E2E가 생기면 이 절에 다시 추가한다.

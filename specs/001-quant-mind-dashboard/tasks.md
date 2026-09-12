---

description: "Task list template for feature implementation"
---

# Tasks: QUANT-MIND 공동 자산 관리 대시보드

**Input**: Design documents from `/specs/001-quant-mind-dashboard/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md,
DESIGN.md, DESIGN.quantmind.md

**Tests**: 포함됨 — plan.md §13(테스트 전략)과 헌장 원칙 XVII(실패한 테스트/빌드는
완료 처리 금지)에 따라 각 User Story마다 컴포넌트/단위 테스트와 Playwright E2E를
포함한다.

**Organization**: 사용자 요청에 따라 (1) Mock Data로 세 User Story의 UI를 먼저
완성 → (2) `/design-sync` → (3) Sheets 어댑터(U5)로 US1/US2 실데이터 연동 →
(4) Supabase 협업 기능(U4)으로 US3 실데이터 연동 순서로 구성한다. 각 Phase 내
Task는 여전히 대응 User Story([US1]/[US2]/[US3])로 태깅해 추적성(헌장 원칙 XVI)을
유지한다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 실행 가능(다른 파일, 선행 의존성 없음)
- **[Story]**: 해당 태스크가 속한 User Story(US1/US2/US3)
- 각 설명에는 정확한 파일 경로를 포함한다

## Path Conventions

리포지토리 루트 기준 `src/`, `supabase/`, `apps-script/`, `tests/` (plan.md
"Project Structure" 참조)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 프로젝트 초기화 및 기본 도구 구성

- [X] T001 Vite + React + TypeScript 프로젝트 스캐폴드 생성 (`package.json`,
      `vite.config.ts`, `tsconfig.json`)
- [X] T002 [P] ESLint + Prettier 설정 (`.eslintrc.cjs`, `.prettierrc`)
- [X] T003 [P] Vitest + Testing Library 설정 (`vitest.config.ts`,
      `tests/setupTests.ts`)
- [X] T004 [P] Playwright 설정, 데스크톱·모바일 프로젝트 정의
      (`playwright.config.ts`, 헌장 원칙 XV)
- [X] T005 `.env.example` 작성 (`VITE_DATA_SOURCE`, `VITE_SUPABASE_URL`,
      `VITE_SUPABASE_ANON_KEY`) — quickstart.md §0 참조
- [X] T006 [P] MSW mock 인프라 초기 설정 (`src/mocks/browser.ts`,
      `src/mocks/handlers.ts`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 세 User Story 어느 것도 이 단계 완료 전에는 시작할 수 없는 공통 기반

**⚠️ CRITICAL**: 이 Phase가 끝나기 전에는 User Story 작업을 시작하지 않는다

- [X] T007 도메인 타입 정의 (`Account`, `Holding`, `PersonalAggregate`,
      `HouseholdAggregate`, `Agenda`, `Opinion`, `AgreementRecord`,
      `MappingRule`) — data-model.md 기준, `src/types/domain.ts`
- [X] T008 `DataSourceProvider` 구현(mock↔supabase 전환 스위치) in
      `src/app/providers/DataSourceProvider.tsx` (research.md §4)
- [X] T009 [P] `AuthProvider` 구현(Supabase 세션 상태, 로그인/로그아웃) in
      `src/app/providers/AuthProvider.tsx` (FR-001)
- [X] T010 [P] 라우팅 및 보호 라우트 래퍼 구현 — 비인증 접근 시 로그인 안내로
      리다이렉트 in `src/app/routes.tsx` (FR-002)
- [X] T011 [P] 공통 상태 컴포넌트 `LoadingState`/`EmptyState`/`ErrorState` in
      `src/components/ui/` (FR-023)
- [X] T012 [P] 공통 `StatusBadge`(색상+텍스트 병기) in
      `src/components/ui/StatusBadge.tsx` (헌장 원칙 XIII)
- [X] T013 [P] `DisclaimerBanner`("참고용 — 투자 권유 아님") in
      `src/components/layout/DisclaimerBanner.tsx` (FR-008)
- [X] T014 [P] 세 화면 공통 `AppShell`/`NavBar` 레이아웃 in
      `src/components/layout/AppShell.tsx` (헌장 원칙 XII)
- [X] T015 [P] 디자인 토큰 및 `prefers-reduced-motion` 규칙 in
      `src/styles/tokens.css` (헌장 원칙 XIV)
- [X] T016 [P] 안건/의견 길이 검증 zod 스키마(제목 1~100자, 내용/의견 1~2000자,
      공백 제거 기준) in `src/lib/validation/agenda.ts` (FR-016, FR-017)
- [X] T017 [P] 통화/수익률/시각 포맷터 in `src/lib/format.ts`
- [X] T018 기준 Mock 픽스처 생성(정상 케이스, 조건부 항목 전부 null인 종목,
      미매핑 종목, 의견 0건 합의완료 안건 포함) in `src/mocks/fixtures/`

**Checkpoint**: 공통 기반 완료 — User Story별 UI 구현 시작 가능

---

## Phase 3: User Story 1 - 통합 자산 현황과 비중 확인 (Priority: P1, Mock) 🎯 MVP

**Goal**: 계좌 → 개인 통합 → 부부 통합 3단계 자산 현황과 성장/방어/현금 비중,
논의 중 안건 요약, 기준 시점을 Mock 데이터로 대시보드에 표시

**Independent Test**: Mock 모드(`VITE_DATA_SOURCE=mock`)로 로그인 후 대시보드에
접속해, 나의 개인 통합/상대방의 개인 통합/부부 통합/비중/기준 시점이 모두 표시되는지
다른 화면 없이 확인

### Tests for User Story 1

- [X] T019 [P] [US1] 대시보드 6개 상태(로딩/빈 목록/오류/권한 없음/저장 중/데이터
      없음) 및 3단계 집계 렌더링 컴포넌트 테스트 in `tests/unit/dashboard.test.tsx`
- [X] T020 [US1] User Story 1 Given-When-Then 시나리오 Playwright E2E(데스크톱+
      모바일) in `tests/e2e/dashboard.spec.ts`

### Implementation for User Story 1

- [X] T021 [P] [US1] `useDashboardSummary` 훅(mock 어댑터) in
      `src/features/dashboard/hooks/useDashboardSummary.ts`
- [X] T022 [P] [US1] `PersonalAggregateCard`(개인 통합 총액·수익률, 본인/상대방
      공용) in `src/features/dashboard/components/PersonalAggregateCard.tsx`
      (FR-005, 헌장 원칙 XXI, XXIV)
- [X] T023 [US1] `HouseholdAggregateCard`("나 OOO원(+O%)" / "상대방..." / "부부
      합계...") in `src/features/dashboard/components/HouseholdAggregateCard.tsx`
      (FR-005, FR-005a, 헌장 원칙 XXI, XXIV)
- [X] T024 [US1] `AllocationLegend`(성장/방어/현금 비중, 색상+텍스트) in
      `src/features/dashboard/components/AllocationLegend.tsx` (FR-006, 헌장
      원칙 XIII)
- [X] T025 [US1] `AgendaSummaryList`(논의중 안건 요약) in
      `src/features/dashboard/components/AgendaSummaryList.tsx` (FR-007)
- [X] T026 [US1] `SyncStatusBanner`("기준 시점: YYYY-MM-DD HH:mm 기준" + 동기화
      실패 배지) in `src/features/dashboard/components/SyncStatusBanner.tsx`
      (FR-024)
- [X] T027 [US1] `DashboardPage` 조립(위 컴포넌트 + `DisclaimerBanner` +
      로딩/빈 목록/오류/권한 없음 상태 처리) in `src/pages/DashboardPage.tsx`
      (FR-008, FR-023)
- [X] T028 [US1] 대시보드용 Mock 핸들러/픽스처 연결(개인/부부 통합, 비중, 안건
      요약, 기준 시점) in `src/mocks/handlers.ts`

**Checkpoint**: User Story 1이 Mock 데이터로 독립적으로 완전히 동작

---

## Phase 4: User Story 2 - 계좌·종목 상세 조회와 분류 수정 (Priority: P2, Mock)

**Goal**: 계좌별 요약(빠른 확인 모드)과 종목별 상세(상세 모드)를 조회하고, 종목
분류를 수동으로 변경할 수 있는 화면을 Mock 데이터로 완성

**Independent Test**: 계좌·종목 데이터가 있는 상태에서 이 화면 단독 접근 →
빠른 확인 모드 → 상세 모드 → 분류 변경까지 완결된 흐름으로 검증

### Tests for User Story 2

- [X] T029 [P] [US2] 분류 변경 및 조건부 항목(종목코드/통화/평균 매입가/배당)
      null·미매핑 처리 컴포넌트 테스트 in `tests/unit/holdings.test.tsx`
- [X] T030 [US2] User Story 2 Given-When-Then 시나리오 Playwright E2E(데스크톱+
      모바일) in `tests/e2e/holdings.spec.ts`

### Implementation for User Story 2

- [X] T031 [P] [US2] `useAccounts`/`useHoldingDetail` 훅(mock 어댑터) in
      `src/features/holdings/hooks/` (FR-009, FR-010)
- [X] T032 [P] [US2] `AccountSummaryTable`(빠른 확인 모드: 계좌명, 합계
      평가금액, 대표 손익률) in
      `src/features/holdings/components/AccountSummaryTable.tsx` (FR-009,
      헌장 원칙 XXI, XXIV)
- [X] T033 [US2] `HoldingDetailPanel`(상세 모드: 필수 항목 전체 + 조건부 항목
      "데이터 없음"/"미매핑" 표시) in
      `src/features/holdings/components/HoldingDetailPanel.tsx` (FR-010,
      FR-012, FR-013, FR-015, 헌장 원칙 XXI, XXIV)
- [X] T034 [US2] `ClassificationSelect`(성장/방어/현금 수동 변경) in
      `src/features/holdings/components/ClassificationSelect.tsx` (FR-011)
- [X] T035 [US2] `QuickModeToggle`(빠른 확인 ↔ 상세 모드 전환) in
      `src/features/holdings/components/QuickModeToggle.tsx`
- [X] T036 [US2] `HoldingsPage` 조립(위 컴포넌트 + 상태 처리, 분류 변경 시
      대시보드 비중 즉시 반영 연동 지점 표시) in `src/pages/HoldingsPage.tsx`
      (FR-011, FR-023)
- [X] T037 [US2] 계좌·종목용 Mock 핸들러/픽스처 연결(조건부 항목 null 종목,
      미매핑 종목 포함) in `src/mocks/handlers.ts`

**Checkpoint**: User Story 1과 2가 Mock 데이터로 함께 독립 동작

---

## Phase 5: User Story 3 - 투자 안건 작성과 합의 기록 (Priority: P3, Mock)

**Goal**: 안건 작성 → 상대 운영자 의견 → 합의 확정(의견 0건도 허용) → 확정 목록
재조회 흐름을 Mock 데이터로 완성

**Independent Test**: 계좌 데이터 유무와 무관하게, 안건 작성 → 의견 등록 → 합의
확정 → 재조회까지 이 화면만으로 검증

### Tests for User Story 3

- [X] T038 [P] [US3] 입력 규칙(제목 1~100자/내용·의견 1~2000자, 공백만 입력
      거부), 작성자 전용 수정(FR-016a), 의견 0건 합의 확정(FR-019) 컴포넌트
      테스트 in `tests/unit/judgment-log.test.tsx`
- [X] T039 [US3] User Story 3 Given-When-Then 시나리오 Playwright E2E(데스크톱+
      모바일) in `tests/e2e/judgment-log.spec.ts`

### Implementation for User Story 3

- [X] T040 [P] [US3] `useAgendas`/`useAgendaDetail` 훅(mock 어댑터) in
      `src/features/judgment-log/hooks/`
- [X] T041 [P] [US3] `AgendaForm`(제목/내용 작성 및 검증, "논의중" 상태에서
      작성자 본인만 수정 가능) in
      `src/features/judgment-log/components/AgendaForm.tsx` (FR-016, FR-016a)
- [X] T042 [P] [US3] `AgendaList`(논의중/합의완료 `StatusBadge` 표시, 각 안건에
      작성자·작성 시각 함께 렌더링) in
      `src/features/judgment-log/components/AgendaList.tsx` (FR-018, FR-022)
- [X] T043 [US3] `OpinionThread`(의견 목록·작성, 1~2000자 검증, 각 의견에
      작성자·작성 시각 함께 렌더링) in
      `src/features/judgment-log/components/OpinionThread.tsx` (FR-017,
      FR-022)
- [X] T044 [US3] `AgreementConfirmButton`(의견 0건에서도 확정 허용) in
      `src/features/judgment-log/components/AgreementConfirmButton.tsx`
      (FR-019)
- [X] T045 [US3] `JudgmentLogPage` 조립(작성/의견/확정/재조회 흐름 + 상태 처리)
      in `src/pages/JudgmentLogPage.tsx` (FR-020, FR-023)
- [X] T046 [US3] 판단 로그용 Mock 핸들러/픽스처 연결(의견 0건 합의완료 안건,
      입력 규칙 위반 케이스 포함) in `src/mocks/handlers.ts`

**Checkpoint**: 세 User Story 모두 Mock 데이터로 독립 동작 — `/design-sync` 진행
가능

---

## Phase 6: Design Sync (세 화면 디자인 일관성 검증)

**Purpose**: 실제 데이터 연동 전에 세 화면의 정보 구조·상태 표시·모션 접근성을
점검(plan.md §15, research.md §5)

- [ ] T047 `/design-sync` 실행 — `DashboardPage`/`HoldingsPage`/
      `JudgmentLogPage`의 정보 구조 일관성(헌장 원칙 XII), 상태 색상+텍스트
      병기(원칙 XIII), `prefers-reduced-motion` 대응(원칙 XIV) 점검. 다음 항목도
      함께 점검한다(헌장 원칙 XVIII, XX~XXII, XXIV):
      · `DESIGN.quantmind.md` 대조 — `tokens.css`의 색상/타이포/컴포넌트 값이
        `DESIGN.md`와 다를 경우 그 차이가 `DESIGN.quantmind.md`에 근거와 함께
        기록되어 있는지 확인
      · 등락 색상 규칙(상승 빨강 / 하락 파랑) — 등락을 표시하는 모든 화면에서
        초록/보라가 등락 표시에 쓰이지 않는지 확인
      · `StatusBadge`와 시장 데이터의 색 체계 분리 — 등락 표시가 `StatusBadge`
        컴포넌트를 재사용하지 않고 `.num`/`.num--rise`/`.num--fall` 등 전용
        클래스만 사용하는지 확인
      · tabular figures / 우측 정렬 / 고정 소수점 — 금액·수량·수익률을 표시하는
        모든 숫자에 `font-variant-numeric: tabular-nums`, 우측 정렬, 항목별 고정
        소수점 자리수가 적용되어 있는지 확인
- [ ] T048 `/design-sync` 지적 사항 반영 — 세 화면 컴포넌트/레이아웃 수정 in
      `src/components/layout/`, `src/features/*/components/`

**Checkpoint**: 디자인 일관성 확인 완료 — 실데이터 연동(Sheets 어댑터) 시작 가능

---

## Phase 7: Cross-Cutting (헌장 v1.1.0 반영 — 소급 기록)

**Purpose**: 헌장이 1.0.0 → 1.1.0으로 개정되며 추가된 원칙(XVIII~XXIV: DESIGN.md
기준 채택, 등락 색상 규칙, StatusBadge·시장 데이터 색 체계 분리, 상표 폰트
비복제)을 Mock 단계(Phase 3~5) 완료 직후 곧바로 반영한 작업을 태스크로 소급
기록한다. 세 User Story의 컴포넌트를 동시에 수정하는 작업이라 특정 User
Story에 종속되지 않는 Cross-cutting 태스크로 분류한다. (실제 작업은 Phase 6
`/design-sync` 공식 실행 이전에 이미 완료됨 — 이후 T047/T048에서 재검증)

- [X] T071 [X](Cross-cutting) 헌장 v1.1.0 반영 — `StatusBadge` tone 체계를
      `positive/negative` → `neutral/success/error/warning`으로 전환하여
      시스템 상태 전용 의미로 고정(헌장 원칙 XIII, XXII) in
      `src/components/ui/StatusBadge.tsx`,
      `src/features/dashboard/components/SyncStatusBanner.tsx`,
      `src/features/holdings/components/AccountSummaryTable.tsx`,
      `src/features/holdings/components/HoldingDetailPanel.tsx`,
      `src/features/judgment-log/components/AgendaList.tsx`,
      `src/pages/JudgmentLogPage.tsx`
- [X] T072 [X](Cross-cutting) 등락 색상 토큰(`--color-rise`/`--color-fall` 등,
      라이트·다크) 도입 및 `.num`/`.num--rise`/`.num--fall` 유틸리티 클래스
      적용(헌장 원칙 XXI, XXIV) in `src/styles/tokens.css`,
      `src/lib/format.ts`(`returnRateToneClass`),
      `src/features/dashboard/components/PersonalAggregateCard.tsx`,
      `src/features/dashboard/components/HouseholdAggregateCard.tsx`,
      `src/features/holdings/components/AccountSummaryTable.tsx`,
      `src/features/holdings/components/HoldingDetailPanel.tsx`
- [X] T073 [X](Cross-cutting) Kraken 전용 폰트(Kraken-Brand/Kraken-Product)
      대신 Pretendard Variable 웹폰트 로드(헌장 원칙 XXIII) in `index.html`

**Checkpoint**: 세 User Story 모두 헌장 v1.1.0의 디자인 원칙을 반영한 상태 —
Sheets 어댑터(Phase 8) 시작 가능

---

## Phase 8: Sheets 어댑터(U5) — Google Sheets → Supabase → US1/US2 실데이터

**Goal**: Mock을 실제 Google Sheets 기반 스냅샷(Apps Script → Supabase)으로
교체해 대시보드·계좌·종목 리스트가 실데이터로 동작

- [ ] T049 Supabase 프로젝트에 `contracts/supabase-schema.sql` 적용(테이블,
      `personal_aggregate_view`/`household_aggregate_view`/`allocation_view`/
      `public_allocation_view`, 트리거, `upsert_sync_status` 함수)
- [ ] T050 Supabase 프로젝트에 `contracts/rls-policies.sql` 적용(household 단위
      정책, `is_household_member` 함수)
- [ ] T051 [P] `syncSnapshot.gs` 구현 — 시트 값 읽기 전용, 표준 페이로드 변환,
      `upsert_snapshot` RPC 호출 in `apps-script/src/syncSnapshot.gs`
      (contracts/apps-script-payload.md, 헌장 원칙 IX)
- [ ] T052 [P] `mappingHelpers.gs` 구현 — `mapping_rule` 조회 및 `security_key`
      결정 로직 in `apps-script/src/mappingHelpers.gs` (FR-015)
- [ ] T053 Apps Script 시간 기반 트리거(매일 저녁 7시, Asia/Seoul) + 스프레드시트
      커스텀 메뉴 "지금 동기화" 등록 in `apps-script/appsscript.json` /
      `apps-script/src/syncSnapshot.gs`
- [ ] T054 `syncSnapshot.gs`에 실패 처리 추가 — try/catch로 감싸 실패 시에도
      `upsert_sync_status` RPC 호출 및 Stackdriver 로그 기록
- [ ] T055 Supabase 어댑터 구현 — `useAccounts`/`useHoldingDetail`/
      `useDashboardSummary`가 `personal_aggregate_view`/
      `household_aggregate_view`/`allocation_view`를 조회하도록 구현 in
      `src/features/dashboard/api/`, `src/features/holdings/api/`
- [ ] T056 [US1] `DashboardPage`/`SyncStatusBanner`를 Supabase 어댑터에 연결,
      `as_of_synced_at`/`has_sync_failure` 반영 (FR-024)
- [ ] T057 [US2] `HoldingsPage`를 Supabase 어댑터에 연결, `is_mapped=false`
      종목에 수동 매핑 등록 UI 추가(`mapping_rule` INSERT) (FR-015)
- [ ] T058 [P] RLS 통합 테스트 — household 스코프 SELECT 검증, 비로그인/anon
      요청 시 금액 컬럼 미포함 확인, `public_allocation_view` 컬럼 목록에
      금액(`market_value_krw`, `weighted_return_rate` 등) 관련 컬럼이 전혀
      없는지 어서션 포함 (FR-004) in `tests/integration/rls.test.ts`
- [ ] T059 quickstart.md §3 절차 수동 실행 — 서로 다른 표기 두 계좌 동기화 후
      미매핑 노출 확인

**Checkpoint**: US1·US2가 실제 Google Sheets 기반 데이터로 동작

---

## Phase 9: Supabase 협업 기능(U4) — Agenda/Opinion/Agreement 실데이터

**Goal**: 판단 로그(Mock)를 실제 Supabase 테이블 기반 협업 기능으로 교체

- [ ] T060 `agenda`/`opinion`/`agreement_record`/`agenda_history` 스키마·RLS·
      트리거(`fn_preserve_agenda_history`, `fn_confirm_agenda`) 적용 검증(이미
      T049/T050에 포함된 정의 확인 및 필요 시 보정)
- [ ] T061 Supabase 어댑터 구현 — `useAgendas`/`useAgendaDetail`이 agenda/
      opinion/agreement_record를 CRUD하도록 구현 in
      `src/features/judgment-log/api/`
- [ ] T062 [US3] `JudgmentLogPage`를 Supabase 어댑터에 연결 — "논의중" +
      작성자 본인만 수정 가능 규칙을 RLS(UPDATE 정책) + UI에서 함께 강제
      (FR-016a)
- [ ] T063 [US3] `AgreementConfirmButton`을 `agreement_record` INSERT에 연결
      (의견 0건 허용, FR-019)
- [ ] T064 [P] 통합 테스트 — 합의완료 안건 수정 시 `agenda_history`에 append되고
      원본이 덮어써지지 않는지 검증 in `tests/integration/agenda-history.test.ts`
      (FR-021)
- [ ] T065 quickstart.md §4 절차 수동 실행 — 두 테스트 계정 교차 의견, 의견 0건
      합의 확정, 비로그인 접근 시 데이터 미반환 확인

**Checkpoint**: 세 User Story 모두 실데이터 기반으로 완전히 동작

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: 세 User Story 전반에 걸친 마무리 점검

- [ ] T066 [P] 접근성/모션 감소 재점검 — `prefers-reduced-motion` 환경에서 세
      화면 애니메이션 무력화 확인(헌장 원칙 XIV)
- [ ] T067 [P] 데스크톱·모바일 뷰포트 수동 회귀 점검 — 세 User Story 전체
      시나리오(헌장 원칙 XV)
- [ ] T068 [P] 보안 점검 — `.env`가 `.gitignore`에 포함, service role key가
      Apps Script 스크립트 속성에만 존재, 레포에 하드코딩된 키 없음(헌장 원칙
      IV)
- [ ] T069 전체 테스트(vitest + playwright 데스크톱/모바일) 및 빌드 실행 — 실패 시
      완료 처리 금지(헌장 원칙 XVII)
- [ ] T070 [P] `quickstart.md`를 실제 구현 결과에 맞게 최종 업데이트

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 의존성 없음 — 즉시 시작 가능
- **Foundational (Phase 2)**: Setup 완료 후 — 모든 User Story를 블로킹
- **User Stories Mock (Phase 3~5)**: Foundational 완료 후 시작 가능. 우선순위
  순서(US1→US2→US3)로 진행하되, 인력이 있으면 병렬 가능
- **Design Sync (Phase 6)**: Phase 3~5(세 화면 Mock 완성) 전부 완료 후 시작
- **Cross-Cutting (Phase 7)**: 헌장 v1.1.0 반영 작업으로, Phase 3~5 완료 직후
  이미 완료됨(소급 기록). 이후 재작업 필요 시 Phase 6 완료 후 진행
- **Sheets 어댑터 U5 (Phase 8)**: Phase 6·7 완료 후 시작
- **Supabase 협업 U4 (Phase 9)**: Phase 8 완료 후 시작(schema/RLS를 Phase 8에서
  이미 적용했으므로 이어서 진행)
- **Polish (Phase 10)**: Phase 9까지 완료 후

### User Story Dependencies

- **User Story 1 (P1)**: Foundational 이후 시작, 다른 스토리에 의존하지 않음
- **User Story 2 (P2)**: Foundational 이후 시작 가능, 대시보드 비중 반영과
  연동되지만 독립적으로 테스트 가능
- **User Story 3 (P3)**: Foundational 이후 시작 가능, 자산 데이터 유무와 무관하게
  독립적으로 테스트 가능

### Within Each User Story

- 테스트 작성 → 훅/모델 → 컴포넌트 → 페이지 조립 → Mock 데이터 연결

### Parallel Opportunities

- Phase 1의 [P] 태스크(T002~T004, T006) 병렬 가능
- Phase 2의 [P] 태스크(T009~T017) 병렬 가능
- Phase 3~5는 Foundational 완료 후 인력이 있으면 스토리 단위로 병렬 진행 가능
- 각 스토리 내 [P] 표시된 컴포넌트/훅 태스크는 병렬 가능
- Phase 8의 T051/T052(Apps Script 두 파일)는 병렬 가능
- Phase 10의 [P] 태스크(T066~T068, T070)는 병렬 가능

---

## Parallel Example: User Story 1

```bash
# Foundational 완료 후 User Story 1 컴포넌트 병렬 착수:
Task: "useDashboardSummary 훅(mock 어댑터) in src/features/dashboard/hooks/useDashboardSummary.ts"
Task: "PersonalAggregateCard 컴포넌트 in src/features/dashboard/components/PersonalAggregateCard.tsx"
```

---

## Implementation Strategy

### 데모 가능한 MVP (Mock 기반, User Story 1만)

1. Phase 1: Setup 완료
2. Phase 2: Foundational 완료(필수 — 모든 스토리를 블로킹)
3. Phase 3: User Story 1(Mock) 완료
4. **STOP and VALIDATE**: quickstart.md §1 절차로 대시보드 단독 검증
5. Mock 기반 데모/공유 가능(단, 실사용 가능한 배포는 Phase 8까지 필요)

### 점진적 전달

1. Setup + Foundational → 기반 완료
2. US1(Mock) 추가 → 독립 검증 → 데모(MVP)
3. US2(Mock) 추가 → 독립 검증 → 데모
4. US3(Mock) 추가 → 독립 검증 → 데모
5. `/design-sync`(Phase 6)로 세 화면 일관성 확정
6. Cross-Cutting(Phase 7)으로 헌장 v1.1.0 디자인 원칙 반영(소급 완료)
7. Sheets 어댑터(Phase 8)로 US1·US2를 실데이터로 전환 → 실사용 가능한 첫 배포
8. Supabase 협업 기능(Phase 9)으로 US3를 실데이터로 전환 → 전체 기능 완성
9. Polish(Phase 10)로 접근성·반응형·보안·테스트 게이트 최종 확인

---

## Notes

- [P] 태스크 = 서로 다른 파일, 선행 의존성 없음
- [Story] 라벨은 태스크를 특정 User Story에 매핑해 추적성(헌장 원칙 XVI)을 제공
- Mock 단계에서는 세 스토리가 서로 독립적으로 완성·검증되지만, 실데이터 전환은
  사용자 지정 순서(디자인 동기화 → Sheets 어댑터 → Supabase 협업)를 그대로 따름
- 각 Phase 완료 전 관련 테스트가 실패 상태에서 통과로 바뀌는지 확인(헌장 원칙 XVII)
- 논리적 작업 단위마다 커밋
- 체크포인트에서 멈춰 해당 스토리를 독립적으로 검증할 것

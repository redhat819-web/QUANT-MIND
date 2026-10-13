---

description: "002 부부 가입·연결 온보딩 구현 작업 목록"
---

# Tasks: 부부 가입·연결 온보딩 (상용화 기반)

**Input**: `specs/002-household-onboarding/`의 설계 문서

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: 포함한다. plan R14와 헌장 원칙 XVII(테스트 통과 전 완료 금지)를 따른다. 각 스토리의 테스트를 먼저
쓰고 실패를 확인한 뒤 구현한다.

**Organization**: 사용자 스토리별로 나눠 각자 독립적으로 구현·검증할 수 있게 한다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 가능(다른 파일, 미완료 작업에 의존하지 않음)
- **[Story]**: 해당 사용자 스토리(US1~US5)
- 설명 끝의 `(FR-…, SC-…, 문서 §)`는 요구사항·설계 근거다(헌장 원칙 XVI)

## Path Conventions

단일 SPA + BaaS 구조. `src/`, `supabase/migrations/`, `tests/`, `public/`는 리포지토리 루트 기준이다(plan
"Project Structure").

## ⛔ 착수 게이트

- **G1(전체)**: 판단 로그·대시보드 Supabase 어댑터가 main에 머지되어 있어야 한다. 머지 대상은
  `fix/judgment-log-save-state`, `feat/supabase-read-adapters`, `feat/judgment-log-supabase`이고, 이
  브랜치를 그 위로 rebase한다. 이 작업들이 `supabaseDashboard.ts`, `supabaseAgendas.ts`를 고친다. → T001
- **G2(US3)**: 헌장 2.0.0 원칙 IX가 발효되어야 한다(상대 운영자 동의). → T030
- **G3(US4)**: 헌장 2.0.0 원칙 VII·VIII가 발효되어야 한다. → T044

G2·G3가 열리지 않으면 해당 스토리만 보류하고 나머지는 진행한다(plan Constitution Check).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 의존성, 환경변수, 공통 타입 준비

- [ ] T001 게이트 G1 확인: 위 세 PR이 main에 머지됐는지 확인하고 `002-household-onboarding`을 main
  위로 rebase한다. `src/features/dashboard/api/supabaseDashboard.ts`와
  `src/features/judgment-log/api/supabaseAgendas.ts`가 있는지 확인하고, 결과를 이 파일 하단 "진행 메모"에
  기록한다.
- [ ] T002 `read-excel-file`, `write-excel-file`를 dependencies에 추가하고 lockfile을 갱신한다
  (`package.json`, `package-lock.json`). (research R5, R7)
- [ ] T003 [P] `.env.example`에 `VITE_GA_MEASUREMENT_ID`(비어 있으면 분석 비활성)와
  `VITE_TERMS_VERSION`을 설명과 함께 추가한다. (research R8, FR-002)
- [ ] T004 [P] 새 도메인 타입을 `src/types/domain.ts`에 추가한다.
  - 새 타입: `ConsentState`, `Invitation`, `AssetUploadResult`, `AssetTemplateError{row,column,message}`,
    `DepartureRequest`
  - 기존 타입 변경: `PersonalAggregate.isShared`,
    `AgreementRecord.confirmedByDisplayName`·`AgendaHistoryEntry.changedByDisplayName`의 null 허용
  - (data-model §4)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 스토리가 쓰는 스키마, 동의 상태, 라우팅 게이트, mock 상태, 오류 문구

**⚠️ CRITICAL**: 이 단계가 끝나기 전에는 스토리 작업을 시작하지 않는다

- [ ] T005 마이그레이션 `supabase/migrations/20261014120000_onboarding_foundation.sql`을 만든다.
  - `household.created_at`, `household.activation_record_id`
  - `household_members.joined_at`, `shares_assets`(default false), `asset_source`(기존 행은
    `sheet_sync`로 이행)
  - `activation_record` 테이블(클라이언트 권한 없음)
  - (data-model §1–2, research R6, R9)
- [ ] T006 마이그레이션 `supabase/migrations/20261014120100_profile_consent.sql`을 만든다.
  - `user_profile`과 `auth.users` insert 트리거, 기존 사용자 backfill
  - `consent_record`(추가만), RLS(본인 select만)
  - `set_consent` RPC(security definer, `search_path` 고정, authenticated만 execute)
  - (contracts/rpc.md "가입·household", research R3, FR-002, FR-013, FR-018)
- [ ] T007 [P] 새 SQLSTATE(P0010~P0016, 42501)를 기술 용어 없는 문구로 바꾸는 공통 함수를
  `src/lib/rpcErrors.ts`에 만든다. 기존 `toUserMessage`(`supabaseAgendas.ts`)와 같은 형태로 만든다.
  (contracts/rpc.md 공통 오류 코드, FR-024)
- [ ] T008 [P] 온보딩 mock 상태와 fixture를 만든다.
  - fixture: `src/mocks/fixtures/onboarding.ts`(프로필, 동의, 구성원 수, 초대, 업로드, 탈퇴 상태)
  - `src/mocks/handlers.ts`에 상태 초기화 핸들러를 추가한다
  - (AGENTS.md 데이터 소스 규칙)
- [ ] T009 내 프로필·소속 상태를 읽는 훅 `src/features/consent/hooks/useProfile.ts`를 만든다.
  - mock과 supabase 두 모드를 모두 지원한다
  - 반환값: 약관 버전, 분석 동의, 내 household id, 구성원 수, 내 `shares_assets`, 상대 `shares_assets`
  - (data-model §2)
- [ ] T010 `src/app/ProtectedRoute.tsx`에 온보딩 게이트를 추가한다. 약관 미동의 또는 household 미소속이면
  `/onboarding`으로 보낸다. `src/app/routes.tsx`에 `/signup`, `/onboarding`, `/invite`, `/settings` 경로
  골격을 추가한다. (FR-002, US1)
- [ ] T011 [P] 통합 테스트 공통 도우미 `tests/integration/helpers.ts`를 만든다.
  - 로그인 클라이언트 생성
  - QM_IT_* 환경변수 검사와 `skipIf`
  - 테스트 데이터 접두사 `[통합테스트]`
  - 기존 `agenda-history.test.ts`의 `signedIn`을 옮겨온다

**Checkpoint**: 마이그레이션이 dry-run을 통과하고, 기존 001 테스트(`npm test`, `npm run test:e2e`)가
그대로 통과한다.

---

## Phase 3: User Story 1 - 가입하고 우리 집(household) 만들기 (Priority: P1) 🎯 MVP

**Goal**: 처음 온 사람이 이메일로 가입하고, 약관에 동의하고, household를 만든다.

**Independent Test**: 처음 쓰는 이메일로 가입 → 인증 → 약관 동의 → household 생성까지 마치면 빈
대시보드와 배우자 초대 안내가 보인다(spec US1).

### Tests for User Story 1

- [ ] T012 [P] [US1] 통합 테스트 `tests/integration/household-create.test.ts`를 만든다.
  - 약관 미동의 생성 시 P0010
  - 정상 생성 시 구성원 1명과 `activation_record` 생성
  - 두 번째 생성 시 P0011
  - anon 요청 거부
  - (FR-002, FR-003, FR-005)
- [ ] T013 [P] [US1] 단위 테스트 `tests/unit/onboarding.test.tsx`를 만든다.
  - 약관 미동의면 다음 단계 진행 불가
  - 생성 실패 시 오류와 재시도 표시, 입력 유지
  - 성공 시에만 초대 안내로 이동
  - (FR-002, FR-024, AGENTS.md 저장 규칙)
- [ ] T014 [P] [US1] e2e `tests/e2e/onboarding.spec.ts`를 만든다. mock 모드에서 가입 → 약관 → 생성 →
  빈 대시보드와 초대 안내를 데스크톱·모바일에서 확인한다. (SC-001, 원칙 XV)

### Implementation for User Story 1

- [ ] T015 [US1] 마이그레이션 `supabase/migrations/20261014120200_household_rpc.sql`에 `create_household`
  RPC를 만든다.
  - 약관 확인, 기존 소속 확인
  - household, 구성원, `activation_record`를 한 번에 생성. 내부 계정이면 `is_internal`
  - (contracts/rpc.md, research R2, R9, R12)
- [ ] T016 [P] [US1] `src/app/providers/AuthProvider.tsx`에 `signUp`을 추가하고(mock은 즉시 성공)
  `src/pages/SignupPage.tsx`를 만든다.
  - 인증 메일 안내와 다시 보내기
  - 가입 실패 문구
  - `LoginPage.tsx`에 가입 링크
  - (FR-001, Edge Case "인증 메일")
- [ ] T017 [P] [US1] 약관 동의 단계를 만든다.
  - `src/features/consent/components/TermsConsentStep.tsx`
  - `src/features/consent/hooks/useConsent.ts`(mock+supabase, `set_consent` 호출, `onSuccess`에서만 다음
    단계)
  - (FR-002, research R3)
- [ ] T018 [US1] household 생성 단계를 만든다.
  - `src/features/household/hooks/useCreateHousehold.ts`(mock+supabase)
  - `src/features/household/components/CreateHouseholdStep.tsx`(이름 1~40자 zod 검증, 실패 시 입력 유지)
  - (FR-003, FR-004, FR-024)
- [ ] T019 [US1] `src/pages/OnboardingPage.tsx`에서 약관 → 생성 → 초대 안내 순서로 단계를 합친다.
  `src/pages/DashboardPage.tsx`에는 구성원이 1명일 때 "배우자 초대" 안내 빈 상태를 추가한다. (US1-3, 원칙 X)
- [ ] T020 [US1] `src/mocks/handlers.ts`에 가입·약관·생성 MSW 핸들러를 추가한다(P0010·P0011 응답 포함).
  (AGENTS.md 데이터 소스 규칙)

**Checkpoint**: T012~T014가 통과하고, US1만으로 가입부터 빈 대시보드까지 동작한다.

---

## Phase 4: User Story 2 - 배우자 초대와 합류 (Priority: P1)

**Goal**: 구성원이 1회용 초대 링크를 만들고, 배우자가 수락해 같은 household의 동등한 구성원이 된다.

**Independent Test**: A가 링크를 만들고, B가 그 링크로 가입·동의·합류하면 두 사람의 대시보드에 상대방 영역이
함께 보인다(spec US2).

### Tests for User Story 2

- [ ] T021 [P] [US2] 통합 테스트 `tests/integration/invitation.test.ts`를 만든다.
  - 1회 사용
  - 만료·취소 시 P0013
  - 정원 초과 P0012(동시 수락 두 건 중 하나만 성공)
  - 기존 소속 P0011
  - 상대 구성원도 취소 가능
  - `get_invitation_status`는 금액·구성원 정보를 반환하지 않음
  - (FR-004, FR-006~FR-009, 원칙 I·III)
- [ ] T022 [P] [US2] 단위 테스트 `tests/unit/invite.test.tsx`를 만든다.
  - 링크 생성 성공 시에만 링크와 만료 표시
  - 수락 실패 문구와 새 초대 요청 안내
  - URL 조각(`#token`)을 읽은 뒤 주소에서 지움
  - (FR-008, research R2)
- [ ] T023 [P] [US2] `tests/e2e/onboarding.spec.ts`에 초대 생성 → 다른 컨텍스트에서 수락 → 상대 영역 표시
  시나리오를 추가한다(mock, 두 뷰포트). (SC-002)

### Implementation for User Story 2

- [ ] T024 [US2] 마이그레이션 `supabase/migrations/20261014120300_invitation.sql`을 만든다.
  - `invitation` 테이블(`token_hash` 컬럼은 select 권한에서 제외)
  - `create_invitation`, `revoke_invitation`, `get_invitation_status`, `accept_invitation`(pgcrypto
    SHA-256, household 행 `for update` 잠금, `activation_record.partner_joined_at` 기록)
  - (contracts/rpc.md "초대", data-model invitation 상태 전이)
- [ ] T025 [P] [US2] 초대 훅 `src/features/household/hooks/useInvitation.ts`를 만든다.
  - 생성, 취소, 상태 조회, 수락
  - mock+supabase 지원, `rpcErrors` 사용
- [ ] T026 [US2] 초대 패널 `src/features/household/components/InvitePanel.tsx`를 만든다.
  - 링크 생성, 복사, 만료 시각 표시(`formatDateTime`), 취소
  - 구성원이 2명이면 숨김
  - 상태는 `StatusBadge`로 표시(원칙 XIII)
  - (FR-006, FR-007)
- [ ] T027 [US2] `src/pages/InviteAcceptPage.tsx`를 만든다.
  - `#token`을 읽어 sessionStorage에 잠시 보관한 뒤 주소에서 제거
  - 로그인·가입·약관 동의 후 수락
  - 성공 시 대시보드로, 실패 시 사유와 새 초대 요청 안내
  - (FR-008, FR-009, Edge Case "다른 이메일")
- [ ] T028 [US2] 대시보드의 상대방 영역을 고친다. 합류 전이면 "배우자 합류 전" 빈 상태를 보여준다. 수정할
  파일은 `src/features/dashboard/api/supabaseDashboard.ts`(구성원 1명이면 상대 금액을 0으로 채우지 않음)와
  `src/features/dashboard/components/HouseholdAggregateCard.tsx`다. (docs/ACTIVATION_DEFINITION.md §1, 원칙 X)
- [ ] T029 [US2] `src/mocks/handlers.ts`에 초대 생성·취소·상태·수락 MSW 핸들러를 추가한다.

**Checkpoint**: US1+US2만으로 첫 가설("배우자도 합류하는가")의 흐름이 끝까지 동작한다.

---

## Phase 5: User Story 3 - 표준 양식으로 내 자산 올리기와 공개 동의 (Priority: P2)

**Goal**: 구성원이 표준 양식을 올려 자산을 반영하고, 배우자 공개에 동의해야만 상대에게 금액이 보인다.

**Independent Test**: 양식을 내려받아 채워 올리면 내 대시보드에 반영되고, 공개에 동의한 뒤에만 배우자
대시보드에 보인다(spec US3).

### Gate

- [ ] T030 [US3] 게이트 G2 확인: `.specify/memory/constitution.md`에서 2.0.0 원칙 IX가 발효됐는지 확인한다.
  아니면 Phase 5 전체를 보류하고 이 파일 진행 메모에 기록한다. (plan Complexity Tracking)

### Tests for User Story 3

- [ ] T031 [P] [US3] 단위 테스트 `tests/unit/asset-template.test.ts`를 만든다.
  - 머리글 누락
  - 숫자 형식 오류
  - 분류 값 오류
  - 500행 초과
  - 빈 행 무시
  - 분류 한글 → 내부 값 변환
  - 정상 파일의 정규화 결과
  - (contracts/asset-template-v1.md, FR-011)
- [ ] T032 [P] [US3] 통합 테스트 `tests/integration/asset-share.test.ts`를 만든다.
  - 공개 전에는 상대 `account`·`holding`·집계 뷰 행이 응답에 없음
  - 공개 후에는 보임
  - 철회 즉시 사라짐
  - 잘못된 행이면 P0014이고 기존 자산 유지
  - `sheet_sync`면 P0015
  - 업로드 성공 시 기존 내 계좌 전체 교체
  - (FR-011~FR-013, SC-003)
- [ ] T033 [P] [US3] 단위 테스트를 `tests/unit/dashboard.test.tsx`에 추가한다. 상대가 공개하지 않았을 때
  "상대방이 아직 공개하지 않음"과 "내 자산만 포함" 안내가 표시되고 금액이 표시되지 않는지 확인한다.
  (FR-012, research R4)
- [ ] T034 [P] [US3] e2e `tests/e2e/asset-upload.spec.ts`를 만든다(mock, 두 뷰포트).
  - 양식 내려받기 링크
  - 오류 파일 업로드 시 행·열 오류 목록
  - 정상 파일 업로드 시 대시보드 반영
  - (SC-009)

### Implementation for User Story 3

- [ ] T035 [US3] 표준 양식 파일을 만드는 스크립트 `scripts/build-asset-template.ts`를 작성하고,
  `public/templates/quantmind-asset-template-v1.xlsx`를 생성해 커밋한다. 파일에는 `자산` 시트와 `작성 안내`
  시트를 넣고, 버전 셀 `B1 = v1`을 둔다. (contracts/asset-template-v1.md)
- [ ] T036 [P] [US3] 양식 v1 zod 스키마 `src/lib/validation/assetTemplate.ts`를 만든다(열 정의, 오류 문구).
  (contracts/asset-template-v1.md)
- [ ] T037 [US3] `src/features/asset-upload/api/parseTemplate.ts`를 만든다. `read-excel-file`로 읽고
  T036 스키마로 검증해 `{ rows } | { errors }`를 반환한다. 서버에는 아무것도 보내지 않는다. (research R5)
- [ ] T038 [US3] 마이그레이션 `supabase/migrations/20261014120400_asset_upload_share.sql`을 만든다.
  - `asset_upload` 테이블
  - `replace_my_assets`(서버 재검증, 단일 트랜잭션 교체, `last_synced_at` 갱신, 첫 업로드 여부 반환)
  - `record_upload_rejection`
  - `account`·`holding` select 정책을 공개 동의 조건으로 교체
  - (contracts/rpc.md "자산 업로드", "RLS 변경", data-model §1)
- [ ] T039 [US3] 업로드 훅 `src/features/asset-upload/hooks/useAssetUpload.ts`를 만든다.
  - mock+supabase 지원
  - 검증 실패 시 `record_upload_rejection` 호출
  - 성공 시 `dashboard-summary`·`accounts` 무효화
- [ ] T040 [US3] 업로드 패널 `src/features/asset-upload/components/AssetUploadPanel.tsx`를 만든다.
  - 양식 내려받기
  - 파일 선택
  - 오류 표(행·열·이유)
  - 성공 시 반영 시각
  - 실패 시 재시도
  - 온보딩의 초대 안내 다음 단계와 `src/pages/SettingsPage.tsx`에 배치한다
  - (US3-1, US3-2, FR-024)
- [ ] T041 [US3] 공개 동의 UI를 만든다. `src/features/consent/components/ShareConsentToggle.tsx`를
  `SettingsPage`에 넣고, 기존 운영자에게 한 번 보여줄 `ShareConsentPrompt.tsx`도 만든다. 철회는 즉시
  반영한다. (FR-012, FR-013, research R4)
- [ ] T042 [US3] 대시보드에 공개 여부를 반영한다.
  - `supabaseDashboard.ts`가 `household_members.shares_assets`로 `isShared`를 채운다
  - `PersonalAggregateCard.tsx`는 비공개 상태를 표시한다
  - `HouseholdAggregateCard.tsx`는 "내 자산만 포함" 안내를 붙인다
  - `SyncStatusBanner.tsx`는 마지막 반영이 30일을 넘으면 새 파일 안내를 붙인다
  - (FR-012, Edge Case "오래 지난 업로드")
- [ ] T043 [US3] `src/mocks/handlers.ts`에 업로드·공개 동의 MSW 핸들러와 비공개 상대 fixture를 추가한다.

**Checkpoint**: US1~US3으로 두 사람이 자산을 올리고 공개해 부부 합계를 볼 수 있다.

---

## Phase 6: User Story 4 - 데이터 내보내기 후 household 탈퇴와 계정 삭제 (Priority: P2)

**Goal**: 탈퇴를 요청하면 7일 동안 양쪽이 내보낼 수 있고, 그 뒤 떠난 사람의 자산과 작성 기록이 삭제된다.

**Independent Test**: A가 탈퇴를 요청하면 두 사람 모두 내보내기 파일을 받을 수 있다. 기간이 끝나면 B
화면에서 A의 자산과 A가 쓴 기록이 사라진다(spec US4).

### Gate

- [ ] T044 [US4] 게이트 G3 확인: 헌장 2.0.0 원칙 VII·VIII가 발효됐는지 확인한다. 아니면 Phase 6 전체를
  보류하고 진행 메모에 기록한다. (plan Complexity Tracking)

### Tests for User Story 4

- [ ] T045 [P] [US4] 통합 테스트 `tests/integration/departure.test.ts`를 만든다.
  - 요청하면 `scheduled_at`이 7일 뒤
  - 중복 요청 P0016
  - 기간 중 떠나는 사람의 안건·의견·업로드 거부
  - 취소 시 아무것도 삭제되지 않음
  - 상대는 `get_departure_status`로 예정 시각 확인
  - `process_due_departures`는 authenticated가 실행할 수 없음
  - (FR-014a, FR-014d, SC-010)
- [ ] T046 [P] [US4] 단위 테스트 `tests/unit/export.test.ts`를 만든다.
  - 자산 내보내기 → `parseTemplate`로 다시 읽으면 같은 행
  - 판단 로그 내보내기 시트 5개와 열 구성
  - 이메일·id가 없음
  - (SC-011, contracts/export-files.md)
- [ ] T047 [P] [US4] 단위 테스트를 `tests/unit/judgment-log.test.tsx`에 추가한다. 확정자·수정자가 null이면
  "떠난 구성원"으로 표시되는지 확인한다. (FR-014)
- [ ] T048 [P] [US4] e2e `tests/e2e/departure.spec.ts`를 만든다(mock, 두 뷰포트).
  - 탈퇴 요청 확인 화면(삭제 대상·예정 시각)
  - 내보내기
  - 취소
  - 상대 화면 안내 배너
  - (FR-016, FR-014d)

### Implementation for User Story 4

- [ ] T049 [US4] 마이그레이션 `supabase/migrations/20261014120500_departure.sql`을 만든다.
  - `departure_request` 테이블, `is_departing()`
  - agenda·opinion insert 정책과 `replace_my_assets`에 탈퇴 차단 조건 추가
  - `request_departure`, `cancel_departure`, `get_departure_status`
  - `agreement_record.confirmed_by_user_id`·`agenda_history.changed_by_user_id`를 nullable로 변경
  - `process_due_departures`(research R10 순서, 마지막 구성원이면 household 삭제, 계정 삭제 요청 시
    `auth.users` 삭제, 완료 행의 `user_id` null 처리)
  - `pg_cron` 1시간 주기 등록
  - (contracts/rpc.md "탈퇴·삭제", data-model departure_request)
- [ ] T050 [P] [US4] 자산 내보내기 `src/features/export/exportAssets.ts`를 만든다. `write-excel-file`로
  양식 v1과 같은 구조를 쓴다. (contracts/export-files.md §1)
- [ ] T051 [P] [US4] 판단 로그 내보내기 `src/features/export/exportJudgmentLog.ts`를 만든다. 시트는 5개이고,
  사람은 표시 이름만 쓴다. (contracts/export-files.md §2)
- [ ] T052 [US4] 탈퇴 훅 `src/features/household/hooks/useDeparture.ts`를 만든다(요청, 취소, 상태 조회,
  mock+supabase).
- [ ] T053 [US4] 탈퇴 섹션 `src/features/household/components/DepartureSection.tsx`를 만들어
  `SettingsPage.tsx`에 넣는다.
  - 삭제 대상·내보내기·예정 시각 안내와 명시적 확인
  - 계정 삭제 선택
  - 기간 중 취소 버튼
  - (FR-014a, FR-016, FR-017)
- [ ] T054 [US4] 남는 사람용 안내 배너 `src/components/layout/DepartureNoticeBanner.tsx`를 만들어
  `AppShell.tsx`에 넣는다. 탈퇴 예정 사실, 예정 시각, 판단 로그 내보내기 버튼을 보여준다. (FR-014c, FR-014d)
- [ ] T055 [US4] `src/features/judgment-log/api/supabaseAgendas.ts`의 `memberName`과 매퍼가 null 사용자를
  "떠난 구성원"으로 표시하도록 고친다. 기간 중 떠나는 사람의 작성 폼은 막힌 이유를 표시하도록
  `JudgmentLogPage.tsx`를 고친다. (FR-014, FR-014a)
- [ ] T056 [US4] `src/mocks/handlers.ts`에 탈퇴 요청·취소·상태 MSW 핸들러와 탈퇴 진행 중 fixture를 추가한다.

**Checkpoint**: US4가 독립적으로 동작한다. 삭제 실행은 quickstart 2-16 절차로 확인한다.

---

## Phase 7: User Story 5 - 동의 기반 활성화 측정 (Priority: P3)

**Goal**: 동의한 일반 사용자의 단계 성공만 분석 도구로 보내고, household 단위 지표는 서버 기록으로 센다.

**Independent Test**: 동의 사용자로 온보딩을 끝까지 하면 6개 이벤트가 한 번씩 기록된다. 미동의 사용자는 분석
요청이 0건이다(spec US5).

### Tests for User Story 5

- [ ] T057 [P] [US5] 단위 테스트 `tests/unit/analytics.test.ts`를 만든다.
  - 미동의·내부 계정·mock 모드에서는 gtag 스크립트를 넣지 않음
  - 허용 목록 밖 속성은 버림
  - `/invite#token` 경로는 `/invite`로 보냄
  - 철회 시 쿠키 삭제 호출
  - (FR-018~FR-021, SC-004, SC-005, contracts/analytics-events.md)
- [ ] T058 [P] [US5] 통합 테스트 `tests/integration/activation.test.ts`를 만든다.
  - `record_valid_summary_view`는 조건 ①~⑤ 중 하나라도 빠지면 `counted=false`
  - 모두 충족하면 `first_valid_view_at`이 한 번만 설정됨
  - 같은 날 두 번 호출해도 `activation_view_day`는 1행
  - `activation_record`·`activation_view_day`를 클라이언트가 읽을 수 없음
  - (data-model §3, FR-022)

### Implementation for User Story 5

- [ ] T059 [US5] 분석 게이트와 전송 함수를 만든다.
  - `src/app/providers/AnalyticsProvider.tsx`: 동의·`is_internal`·데이터 소스를 확인하고, 측정 ID가 있을
    때만 gtag를 동적으로 불러온다. 라우트가 바뀌면 경로 패턴으로 page_view를 보낸다
  - `src/lib/analytics.ts`: `track(event, props)`, 허용 속성 목록 적용
  - `App.tsx`에 연결한다
  - (research R8, contracts/analytics-events.md)
- [ ] T060 [US5] 분석 동의 UI `src/features/consent/components/AnalyticsConsentToggle.tsx`를 만든다.
  - 로그인 전: 브라우저 저장값(기본 미동의), try/catch로 감쌈
  - 로그인 후: `set_consent('analytics')`
  - 철회 시 `_ga*` 쿠키를 지운다
  - `SignupPage`와 `SettingsPage`에 넣는다
  - (FR-018)
- [ ] T061 [US5] 6개 이벤트를 각 mutation의 성공 시점에만 연결한다.
  - `signup_complete`: AuthProvider의 첫 인증 세션
  - `household_create_success`: `useCreateHousehold`
  - `partner_invite_send`, `partner_invite_accept`: `useInvitation`
  - `data_connect_success`, `first_sync_success`: `useAssetUpload`
  - (FR-020, AGENTS.md "분석 이벤트는 단계별로")
- [ ] T062 [US5] 마이그레이션 `supabase/migrations/20261014120600_activation.sql`에
  `record_valid_summary_view(p_had_sync_failure)`를 만든다. 서버에서 조건을 다시 검사하고,
  `first_valid_view_at`·`last_valid_view_at`·`last_fresh_valid_view_at`을 갱신한다. 같은 마이그레이션에
  `activation_view_day` 테이블을 만들고, 그날(KST) 첫 유효 조회일 때 한 행을 넣는다. (data-model §2–3, research R9)
- [ ] T063 [US5] `src/features/dashboard/hooks/useRecordValidView.ts`를 만든다. 대시보드 조회가 성공하고
  화면 조건(구성원 2명, 두 사람 공개, 기준 시점 있음)을 만족할 때 세션당 한 번 호출한다. `DashboardPage.tsx`에
  연결하며, mock 모드에서는 호출하지 않는다. (docs/ACTIVATION_DEFINITION.md §2)
- [ ] T064 [P] [US5] 읽기 전용 집계 쿼리 `docs/queries/activation-nsm.sql`을 작성한다.
  - Activation Rate(진행 중 코호트·내부 제외)
  - NSM(28일, 최신 데이터)
  - I1·I2
  - G1·G2
  - 4주 가치 재사용률(코호트별, 단순 평균, 가중 비율, 진행 중 코호트 제외)과 28일·35일·56일 비교
  - (docs/ACTIVATION_DEFINITION.md §3, docs/NORTH_STAR_METRIC.md, docs/RETENTION_REVIEW_PRACTICE.md)

**Checkpoint**: quickstart §3(분석 전송 확인)이 모두 기대대로 동작한다.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 여러 스토리에 걸친 보안·문서·배포·검증

- [ ] T065 [P] 보안 점검: 모든 `security definer` 함수에 `set search_path`가 있는지, `authenticated`에만
  execute가 있는지(`process_due_departures` 제외), anon 권한이 없는지 `supabase/migrations/2026101412*.sql`에서
  확인한다. (헌장 II·IV, contracts/rpc.md)
- [ ] T066 [P] `AGENTS.md`에 규칙을 추가한다.
  - 분석 이벤트는 `src/lib/analytics.ts`의 허용 목록으로만 보낸다
  - 동의 게이트를 우회하지 않는다
  - 공개 동의는 RLS로 강제한다
  - (FR-019, FR-021)
- [ ] T067 [P] `docs/USER_FLOW_ANALYSIS.md`의 오래된 내용을 현재 코드에 맞게 고친다(§2의 1·2번은 해결됨).
  가입·초대·업로드 흐름도 추가한다.
- [ ] T068 실서비스 배포 워크플로 `.github/workflows/deploy-production.yml`을 만든다.
  - Cloudflare Pages, `VITE_DATA_SOURCE=supabase`, 수동 실행만
  - 기존 `deploy.yml`의 mock 강제는 그대로 둔다
  - **법률 검토(spec Assumptions) 완료 전에는 실행하지 않는다**
  - (research R11)
- [ ] T069 새 화면(가입, 온보딩, 초대, 설정, 업로드)의 디자인 정합성을 `DESIGN.quantmind.md`와 tokens 기준으로
  확인한다. 차이는 `DESIGN.quantmind.md`에 기록한다. (헌장 XVIII~XX, XII)
- [ ] T070 전체 게이트를 실행한다: `npm run lint && npm test && npm run build && npm run test:e2e`. 실패하면
  완료 처리하지 않는다. (헌장 XVII)
- [ ] T071 quickstart.md §1~§4 검증을 실행하고, 결과를 이 파일 진행 메모에 날짜와 함께 기록한다.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001(게이트 G1)이 가장 먼저다. 나머지는 G1 뒤에 진행한다
- **Foundational (Phase 2)**: Setup 뒤. 모든 스토리를 막는다
- **US1 (Phase 3)**: Foundational 뒤
- **US2 (Phase 4)**: US1의 `create_household`(T015)와 온보딩 화면(T019)이 필요하다
- **US3 (Phase 5)**: Foundational 뒤 + 게이트 G2. 공개 동의 확인에는 구성원 2명이 필요하므로 테스트는
  US2 이후가 편하다
- **US4 (Phase 6)**: Foundational 뒤 + 게이트 G3. 자산 내보내기(T050)는 US3의 양식 스키마(T036)를 쓴다
- **US5 (Phase 7)**: 이벤트 연결(T061)은 US1~US3의 훅이 있어야 한다. 게이트·전송 함수(T059, T060)는
  Foundational 뒤 바로 가능하다
- **Polish (Phase 8)**: 원하는 스토리가 끝난 뒤

### User Story Dependencies

- US1 → US2(초대는 household가 있어야 함)
- US3, US4는 서로 독립(T061만 T046에 의존)
- US5는 다른 스토리의 성공 지점에 이벤트를 붙이므로 마지막

### Within Each User Story

- 테스트 먼저 작성 → 실패 확인 → 마이그레이션 → 훅 → 컴포넌트·페이지 → mock 핸들러
- 마이그레이션은 `--dry-run` 확인 후 사용자 승인을 받고 적용한다(외부 반영 작업)

### Parallel Opportunities

- Setup: T003, T004
- Foundational: T007, T008, T011
- 각 스토리의 테스트 작업([P])
- US3: T046과 T035. US4: T050, T051
- US5의 T059·T073은 US3·US4와 병렬 가능

---

## Parallel Example: User Story 3

```bash
# 테스트 먼저(서로 다른 파일)
Task: "양식 검증 단위 테스트 tests/unit/asset-template.test.ts"
Task: "공개 동의 통합 테스트 tests/integration/asset-share.test.ts"
Task: "비공개 상대 대시보드 테스트 tests/unit/dashboard.test.tsx"
Task: "업로드 e2e tests/e2e/asset-upload.spec.ts"

# 그다음 독립 파일
Task: "양식 zod 스키마 src/lib/validation/assetTemplate.ts"
Task: "양식 파일 생성 scripts/build-asset-template.ts"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. T001 게이트 G1 → Setup → Foundational
2. US1(가입·생성) → 검증
3. US2(초대·합류) → 검증. **여기까지가 첫 가설("배우자도 합류하는가")을 볼 수 있는 최소 범위다**
4. 멈추고 확인한다. 실서비스 공개(T068)는 법률 검토 전에는 하지 않는다

### Incremental Delivery

1. MVP(US1+US2)
2. 헌장 2.0.0 발효 후 US3(업로드·공개) → 부부 합계 가치 완성
3. US4(내보내기·탈퇴) → 상용 출시 전 필수(개인정보 삭제 요구 대응)
4. US5(측정) → Activation·NSM 집계 시작

### 출시 전 체크

- 헌장 2.0.0 발효
- 법률 검토(개인정보 국외 이전, 금융 데이터, 투자 조언 경계)
- 사용자 지정 SMTP 연결(research R1)
- quickstart 전체 통과(T071)

---

## Notes

- [P] 작업은 서로 다른 파일을 다루고 미완료 작업에 의존하지 않는다
- 새 데이터 훅은 mock과 supabase 두 모드를 모두 처리한다. 한쪽만 했다면 여기에 미완료로 남긴다(AGENTS.md)
- 폼은 `onSuccess`에서만 닫거나 비운다. 실패하면 오류와 재시도를 보여준다(AGENTS.md)
- 마이그레이션 적용과 배포는 외부 반영이므로 매번 사용자 승인을 받는다

## 진행 메모

- 2026-10-13: tasks.md 생성. 게이트 G1(선행 PR 머지)과 G2·G3(헌장 2.0.0 동의)이 열려 있지 않다.
- 2026-10-13: 4주 재사용률 측정을 위해 `activation_view_day`를 T058·T062·T064 범위에 추가했다(작업 수 변화 없음).

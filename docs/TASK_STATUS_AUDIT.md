# Task 완료 상태 감사 (초안)

- 대상: `specs/001-quant-mind-dashboard/tasks.md`
- 조사일: 2026-09-26
- 완료 기준: ① 파일 존재 ② 관련 테스트 통과 ③ main 브랜치에 커밋(미커밋 변경 없음)
- **본 문서는 제안 초안이며, tasks.md의 체크 표시는 변경하지 않았습니다. 승인 후 반영합니다.**

## 1. 전체 요약

| 항목 | 수 |
|---|---|
| 전체 Task | 73 (T001~T073) |
| 체크(`[X]`) | 49 (T001~T046, T071~T073) |
| 미체크(`[ ]`) | 24 (T047~T070) |

## 2. 핵심 발견 사항 (요약)

1. **단위 테스트 8건 실패** (`npx vitest run`: 3 files failed / 8 tests failed / 6 passed) — US1(dashboard) 1건, US2(holdings) 3건, US3(judgment-log) 4건.
2. **E2E 최소 2건 실패 확인** (`dashboard.spec.ts`, desktop-chromium) — 로그인 버튼/권한 없음 문구를 5초 내 찾지 못해 timeout. holdings/judgment-log e2e는 시간상 미실행(discover만 확인).
3. **인증 관련 3개 파일이 미커밋 상태로 서로 연결**: `AuthProvider.tsx`(unstaged, `mockSessionStore` 참조 추가), `ProtectedRoute.tsx`(unstaged), `src/lib/session/`(신규 untracked 디렉토리, mockSessionStore.ts/types.ts). 즉 **main에 커밋된 인증 로직과 현재 작업 트리의 인증 로직이 다릅니다.** E2E 실패가 이와 관련 있을 가능성이 있으나 인과관계는 미확인.
4. **`src/mocks/handlers.ts`가 unstaged 상태**이며 대시보드/계좌/판단로그 세 도메인 mock 모두에 영향(T028/T037/T046 공용 파일).
5. **`vitest.config.ts` 파일이 실제로는 존재하지 않음** — 설정이 `vite.config.ts`에 통합되어 있음(T003 파일 경로 명시와 상이, 기능은 충족).
6. **T010 파일 경로 상이**: tasks.md는 `src/app/routes.tsx`를 명시하나 실제로는 `src/app/ProtectedRoute.tsx`로 구현됨.
7. **Phase 6(`/design-sync`, T047/T048)이 실행된 커밋 흔적 없음** — 미체크 상태와 일치(정상).
8. **Phase 8/9(Supabase·Apps Script, T049~T065)**: `supabase/`, `apps-script/`, `contracts/supabase-schema.sql`, `contracts/rls-policies.sql` 전부 없음 — 미체크 상태와 일치(정상).
9. `tsc --noEmit`, `vite build`는 모두 클린 통과.

## 3. Task별 판정표

범례: 판정 = 일치 / 체크누락 / 과잉체크 / 진행중

### Phase 1 — Setup

| Task | 체크 | 근거 파일 | 관련 커밋 | 판정 |
|---|---|---|---|---|
| T001 | X | package.json, vite.config.ts, tsconfig.json (존재) | 9931cdb / de22c7b | 일치 |
| T002 | X | eslint.config.js(존재, **unstaged 수정 있음**), .prettierrc(존재) | 9931cdb, 미커밋 diff 있음 | 진행중 |
| T003 | X | tests/setupTests.ts(존재). **vitest.config.ts 파일 자체는 없음** — 설정이 vite.config.ts에 인라인 통합 | 9931cdb | 과잉체크 (경로 상이, 기능은 충족 — tasks.md 파일 경로 갱신 필요) |
| T004 | X | playwright.config.ts(존재), 14개 e2e 테스트 discover 확인 | 9931cdb | 일치 |
| T005 | X | .env.example(존재) | 9931cdb | 일치 |
| T006 | X | src/mocks/browser.ts(존재), src/mocks/handlers.ts(존재, **unstaged 수정**) | 9931cdb/7ece3c5, 미커밋 diff 있음 | 진행중 |

### Phase 2 — Foundational

| Task | 체크 | 근거 파일 | 관련 커밋 | 판정 |
|---|---|---|---|---|
| T007 | X | src/types/domain.ts | 9931cdb | 일치 |
| T008 | X | src/app/providers/DataSourceProvider.tsx | 9931cdb | 일치 |
| T009 | X | src/app/providers/AuthProvider.tsx — **unstaged 수정(+35/-6), 신규 미커밋 모듈 src/lib/session/mockSessionStore.ts 참조** | 9931cdb(커밋본은 구버전) | 진행중 |
| T010 | X | 명시 파일 src/app/routes.tsx는 없음, 실제로는 src/app/ProtectedRoute.tsx — **unstaged 수정** | 9931cdb(커밋본은 구버전) | 진행중 (파일 경로도 상이) |
| T011 | X | src/components/ui/ (LoadingState/EmptyState/ErrorState) | 9931cdb | 일치 |
| T012 | X | src/components/ui/StatusBadge.tsx | 9931cdb | 일치 |
| T013 | X | src/components/layout/DisclaimerBanner.tsx | 9931cdb | 일치 |
| T014 | X | src/components/layout/AppShell.tsx | 9931cdb | 일치 |
| T015 | X | src/styles/tokens.css | 64cf589 | 일치 |
| T016 | X | src/lib/validation/agenda.ts | 9931cdb | 일치 |
| T017 | X | src/lib/format.ts | 64cf589 | 일치 |
| T018 | X | src/mocks/fixtures/ | 9931cdb | 일치 |

### Phase 3 — User Story 1 (대시보드)

| Task | 체크 | 근거 파일 | 관련 커밋 | 판정 |
|---|---|---|---|---|
| T019 | X | tests/unit/dashboard.test.tsx 존재하나 **테스트 1건 실패** | 9931cdb | 체크누락 (테스트 실패 상태에서 완료 처리됨, 헌장 원칙 XVII 위반 가능성) |
| T020 | X | tests/e2e/dashboard.spec.ts 존재, **desktop-chromium 실행 시 2건 실패(timeout)** | 9931cdb | 체크누락 |
| T021 | X | src/features/dashboard/hooks/useDashboardSummary.ts — **unstaged 수정** | 9931cdb(커밋본은 구버전) | 진행중 |
| T022 | X | PersonalAggregateCard.tsx | 64cf589 | 일치 |
| T023 | X | HouseholdAggregateCard.tsx | 9931cdb | 일치 |
| T024 | X | AllocationLegend.tsx | 9931cdb | 일치 |
| T025 | X | AgendaSummaryList.tsx | 9931cdb | 일치 |
| T026 | X | SyncStatusBanner.tsx | 9931cdb | 일치 |
| T027 | X | src/pages/DashboardPage.tsx (조립 대상 훅/handlers가 미커밋 상태라 실제 동작이 커밋본과 다를 수 있음) | 64cf589 | 진행중 |
| T028 | X | src/mocks/handlers.ts(대시보드 관련) — **unstaged 수정** | 9931cdb(커밋본은 구버전) | 진행중 |

### Phase 4 — User Story 2 (계좌·종목)

| Task | 체크 | 근거 파일 | 관련 커밋 | 판정 |
|---|---|---|---|---|
| T029 | X | tests/unit/holdings.test.tsx 존재하나 **테스트 3건 실패** | 9931cdb | 체크누락 |
| T030 | X | tests/e2e/holdings.spec.ts 존재(미실행, 검증 보류) | 9931cdb | 진행중(미검증) |
| T031 | X | useAccounts.ts / useHoldingDetail.ts — **둘 다 unstaged 수정** | 9931cdb(커밋본은 구버전) | 진행중 |
| T032 | X | AccountSummaryTable.tsx | 9931cdb | 일치 |
| T033 | X | HoldingDetailPanel.tsx | 9931cdb | 일치 |
| T034 | X | ClassificationSelect.tsx | 9931cdb | 일치 |
| T035 | X | QuickModeToggle.tsx | 9931cdb | 일치 |
| T036 | X | src/pages/HoldingsPage.tsx (하위 훅 미커밋 영향) | 9931cdb | 진행중 |
| T037 | X | src/mocks/handlers.ts(계좌·종목 관련) — **unstaged 수정** | 9931cdb(커밋본은 구버전) | 진행중 |

### Phase 5 — User Story 3 (판단 로그)

| Task | 체크 | 근거 파일 | 관련 커밋 | 판정 |
|---|---|---|---|---|
| T038 | X | tests/unit/judgment-log.test.tsx — **unstaged 수정 + 테스트 4건 실패** | 9931cdb(커밋본은 구버전) | 체크누락 |
| T039 | X | tests/e2e/judgment-log.spec.ts 존재(미실행, 검증 보류) | 9931cdb | 진행중(미검증) |
| T040 | X | useAgendas.ts / useAgendaDetail.ts — **둘 다 unstaged 수정**(useAgendaDetail.ts +21/-12) | 9931cdb(커밋본은 구버전) | 진행중 |
| T041 | X | AgendaForm.tsx | 9931cdb | 일치 |
| T042 | X | AgendaList.tsx | 9931cdb | 일치 |
| T043 | X | OpinionThread.tsx | 9931cdb | 일치 |
| T044 | X | AgreementConfirmButton.tsx | 9931cdb | 일치 |
| T045 | X | src/pages/JudgmentLogPage.tsx (하위 훅 미커밋 영향, 실패 테스트가 안건 렌더링 관련) | 64cf589 | 진행중 |
| T046 | X | src/mocks/handlers.ts(판단로그 관련) — **unstaged 수정** | 9931cdb(커밋본은 구버전) | 진행중 |

### Phase 6 — Design Sync (미체크, 정상)

| Task | 체크 | 근거 | 판정 |
|---|---|---|---|
| T047 | 미체크 | `/design-sync` 실행 커밋 흔적 없음(전체 로그에 "design-sync" 매치 0건) | 일치(미체크 상태가 실제와 일치) |
| T048 | 미체크 | 상동, 반영 커밋 없음 | 일치 |

### Phase 7 — Cross-Cutting (헌장 v1.1.0, 소급 기록)

| Task | 체크 | 근거 파일 | 관련 커밋 | 판정 |
|---|---|---|---|---|
| T071 | X | StatusBadge.tsx에 `neutral/success/error/warning` tone 정의 및 6개 파일 전수 사용 확인. 단, "합의완료" 상태가 AgendaList.tsx/JudgmentLogPage.tsx 양쪽에서 `tone="neutral"`로 지정(success/error/warning 어디에도 안 속함) — 의도된 설계인지 확인 필요 | 9931cdb, 미커밋 diff 없음 | 일치 (단, "합의완료=neutral" 의도 재확인 권장) |
| T072 | X | tokens.css에 `--color-rise`/`--color-fall`(라이트·다크) 정의, format.ts에 `returnRateToneClass` 존재, 실사용 확인 | 64cf589, 미커밋 diff 없음 | 일치 |
| T073 | X | index.html에서 Pretendard Variable(jsDelivr CDN) 로드 확인, Kraken 폰트 직접 로드 흔적 없음 | 9931cdb, 미커밋 diff 없음 | 일치 |

### Phase 7.1 — 회귀 수정 (2026-09-27 갱신)

| Task | 체크 | 근거 파일 | 관련 커밋 | 판정 |
|---|---|---|---|---|
| T077 | X | playwright.config.ts baseURL, e2e goto 상대 경로화 | 8c2993f | 일치 |
| T078 | X | src/mocks/fixtures/accounts.ts 계좌명 일반화("나의 증권계좌 A/B", "상대방 증권계좌 A/B") | 96715c9 | 일치 |
| T079 | X | e2e 문구·흐름을 현재 UI/mock 데이터에 맞춤(성장자산/방어자산/현금성자산, 안건 작성 폼 열기, 미매핑 종목을 "기타 비상장 출자금"/상대방 증권계좌 B 기준으로 갱신) | 971cdb9 | 일치 (npx playwright test 대상 7건 중 6건 통과; 나머지 1건은 범위 밖 사전 실패, 아래 참고) |
| T080 | X | spec.md FR-002 문구 명확화("로그인 화면으로 이동해 로그인 안내를 표시") + e2e를 현재 로그인 화면(카드 표시) 기준으로 갱신. `PermissionDeniedState` 복구는 별도 지시로 범위 제외, `LoginPage.tsx` 미변경 | ebdf239 | 일치(범위 축소 반영) |

**참고(범위 밖 사전 실패)**: `tests/e2e/holdings.spec.ts`의 "빠른 확인 모드 → 상세 모드 → 분류 변경까지 완결된 흐름으로 동작한다" 테스트가 `getByText('삼성전자')` 시점에 timeout으로 실패. T078~T080 변경 전(스태시 상태)에도 동일하게 실패함을 확인 — 이번 작업 범위(T078~T080) 밖의 기존 결함이며 손대지 않음.

### Phase 8 — Sheets 어댑터(U5) (미체크, 정상)

T049~T059: `supabase/`, `apps-script/`, `contracts/supabase-schema.sql`, `contracts/rls-policies.sql` 전부 미존재 → 미체크 상태와 일치. 판정: 일치(전체)

### Phase 9 — Supabase 협업(U4) (미체크, 정상)

T060~T065: 위와 동일 사유로 실데이터 연동 기반 자체가 없음 → 미체크 상태와 일치. 판정: 일치(전체)

### Phase 10 — Polish (미체크, 정상)

T066~T070: 관련 산출물 없음(quickstart.md는 존재하나 "최종 구현 결과 반영" 여부 미확인) → 미체크 상태와 일치. 판정: 일치(전체)

## 4. 특별 점검 요청 항목 상세

### T071~T073 (Cross-cutting, 헌장 v1.1.0)
- 세 Task 모두 대상 파일이 **main에 커밋되어 있고 현재 미커밋 변경 없음** → 커밋 기준(③)은 충족.
- T071: tone 체계 전환 자체는 코드에 반영됨. 다만 "합의완료" 안건 상태에 `success`가 아닌 `neutral`이 쓰이는 점은 사양 문구("시스템 상태 전용 의미로 고정")와 별개로 UX 의도 확인이 필요한 사실만 기록.
- T072/T073: 근거 파일·토큰·실사용처 모두 확인됨. 완료로 볼 근거 충분.

### Phase 9 (인증 관련 포함 아님 — Supabase 협업 U4)
- Phase 9는 전부 미체크(T060~T065)이며 Supabase 스키마/RLS/Apps Script 산출물이 저장소에 전혀 없어 **미체크 상태가 정확합니다.** 별도 조치 불필요.

### 인증 관련 Task (T009 AuthProvider, T010 ProtectedRoute/routes)
- 이 두 Task는 tasks.md에 `[X]`로 체크되어 있으나, **현재 작업 트리의 파일이 main에 커밋된 버전과 다릅니다.**
- `AuthProvider.tsx`는 신규 미커밋 모듈 `src/lib/session/mockSessionStore.ts`를 참조하도록 바뀌었고, `src/lib/session/`은 git에 전혀 추적되지 않는 상태(untracked)입니다.
- 완료 기준 ③(main 커밋)을 엄격히 적용하면 **현재 시점 기준으로는 "완료"로 볼 수 없습니다** — 커밋되지 않은 인증 로직 변경이 진행 중인 상태로 보입니다.
- 이는 앞서 조사한 dashboard e2e 로그인 관련 타임아웃 실패와 시간적으로 맞물려 있으나, 인과관계는 확인하지 않았습니다(사실만 기록).

## 5. 다음 단계 제안 (승인 대기)

1. tasks.md 체크 표시 변경 여부는 사용자 승인 후 진행 (본 문서는 제안 초안).
2. 제안: T019/T020/T029/T038(테스트 실패 상태)는 체크 해제 또는 "재검증 필요" 주석 추가 검토.
3. 제안: T009/T010(인증 관련 미커밋 변경)은 해당 변경을 커밋하거나, 체크를 임시 해제하는 방향 검토.
4. T003의 파일 경로 표기(`vitest.config.ts`)를 실제 구조(`vite.config.ts` 통합)에 맞게 갱신 검토.
5. T010의 파일 경로 표기(`src/app/routes.tsx`)를 실제 파일(`src/app/ProtectedRoute.tsx`)에 맞게 갱신 검토.

# QUANT-MIND 사용자 흐름 분석

- 작성일: 2026-10-10
- 갱신일: 2026-10-17. `main` `e0eec8c` 코드 기준으로 행 번호와 상태를 다시 확인함. 그 사이 커밋
  `328b3be`(저장 성공 뒤에만 입력 비우기, 실패 문구 표시)와 `056320c`(판단 로그 Supabase 어댑터)가 반영됨.
- 범위: 대시보드(`/dashboard`), 계좌·종목(`/holdings`), 판단 로그(`/judgment-log`)
- 방법: 코드와 문서만 읽고 정리함. 앱을 실행하거나 테스트를 돌리지는 않음.
- 정본: 요구사항은 `specs/001-quant-mind-dashboard/spec.md`, 진행 상태는 같은 폴더의 `tasks.md`,
  작업 규칙은 `AGENTS.md`, 디자인은 `DESIGN.quantmind.md`를 따름.

## 1. 목적별 행동 흐름

| Job | 화면과 행동 순서 | 파일·함수 근거 | 확인 상태 |
|---|---|---|---|
| 흩어진 자산을 한 번에 보기 | 로그인하지 않았으면 `/login`으로 이동 → 로그인 후 원래 가려던 화면으로 복귀 → 기준 시점 → 나·상대방·부부 합계 → 성장/방어/현금 비중 → 논의 중인 안건 → 안내 문구 | `src/app/routes.tsx:44` (`/`가 `/dashboard`로 이동), `src/app/ProtectedRoute.tsx:16`, `src/pages/LoginPage.tsx:8-16`, `src/pages/DashboardPage.tsx:11-43`, `src/features/dashboard/hooks/useDashboardSummary.ts:20` | 코드로 확인. 대시보드의 안건 요약은 클릭되지 않아서 판단 로그로 가는 경로가 없음 (`AgendaSummaryList.tsx:18`) |
| 합계의 근거를 확인하고 분류 바로잡기 | 빠른 확인(계좌 요약) → 계좌 선택 → 상세 모드로 전환 → 종목 상세 → 분류 select 변경(선택이 곧 제출, 별도 저장 버튼 없음) → 저장 중 → 성공하면 대시보드 비중 쿼리를 다시 불러옴, 실패하면 사유 문구 표시 | `src/pages/HoldingsPage.tsx:17-58`, `QuickModeToggle.tsx`, `ClassificationSelect.tsx:30`, `useHoldingDetail.ts:56-74` (71행에서 `dashboard-summary` 무효화) | 코드로 확인. supabase 모드에서는 저장이 무조건 거부되고(`useHoldingDetail.ts:65`), 거부 사유 "분류는 시트의 '종목분류' 탭에서 변경합니다."가 화면에 보임 (`HoldingsPage.tsx:55-58`) |
| 투자 안건을 논의하고 합의 남기기 | [안건 작성] 클릭 → 제목·내용 입력 → zod 검증 → mutate 호출 → 저장 성공 → 폼 닫힘·목록 다시 불러옴 → 안건 선택 → 의견 등록 → [합의 확정] → 확정자·시각·의견 수 표시 | `src/pages/JudgmentLogPage.tsx:54-79, 205-245`, `AgendaForm.tsx:36-50`, `src/lib/validation/agenda.ts`, `useAgendas.ts:39-54`, `useAgendaDetail.ts:90-140` | 코드로 확인. mock·supabase 두 모드 모두 지원 (`useDataSource()` 분기, 커밋 `056320c`) |

### 단계 구분 (클릭, 검증, 저장 성공)

| 단계 | 안건 작성 | 분류 변경 |
|---|---|---|
| 입력 시작 | `setIsComposing` 토글 (`JudgmentLogPage.tsx:54`) | 상세 모드 진입 (`HoldingsPage.tsx:23`) |
| 유효 제출 | `agendaFormSchema.safeParse` 통과. 합의완료 안건을 고칠 때는 사유가 필수인 `agreedAgendaEditSchema` (`AgendaForm.tsx:39-40`) | 해당 없음 (select라서 값이 항상 유효함) |
| 저장 요청 | `createAgenda.mutate` (`JudgmentLogPage.tsx:69`) | `updateClassification.mutate` (`HoldingsPage.tsx:34`) |
| 저장 성공 | `onSuccess` → 폼 닫기 (`JudgmentLogPage.tsx:77-79`), 입력 비우기 (`AgendaForm.tsx:46-49`), `['agendas']` 무효화 | `onSuccess` → holdings·dashboard·accounts 무효화 |
| 저장 실패 | 입력 유지, 실패 문구 표시 (`JudgmentLogPage.tsx:16-17, 66`) | select가 원래 값으로 돌아가고 사유 문구 표시 (`HoldingsPage.tsx:55-58`) |
| 결과 표시 | 목록에 새 안건 추가 | 대시보드로 돌아가면 비중 갱신 |

## 2. 코드와 문서가 다른 곳

### 해결됨

1. **판단 로그가 mock에서만 동작하던 문제** (10-10 기록). 지금은 `useAgendas`·`useAgendaDetail`이
   `useDataSource()`로 supabase 모드에서 `agenda`·`opinion`·`agreement_record`를 직접 읽고 씀
   (`useAgendas.ts:39-54`, `useAgendaDetail.ts:90-140`, 커밋 `056320c`). 그래서 대시보드의 "논의 중인
   안건"(`supabaseDashboard.ts:140`)과 판단 로그가 같은 데이터를 봄.
2. **안건·의견 폼이 저장 성공 전에 닫히고 입력이 비워지던 문제** (10-10 기록). 지금은 폼 닫기와 입력
   비우기가 저장 성공 뒤에만 일어나고(`JudgmentLogPage.tsx:77-79`, `AgendaForm.tsx:46-49`,
   `OpinionThread.tsx:34`), 실패하면 문구를 보여줌(`JudgmentLogPage.tsx:16-17`). 커밋 `328b3be`.

### 남은 차이와 진행 중인 작업

3. **분류 변경(FR-011)이 supabase 모드에서 거부됨.** 이제 사유 문구는 보이지만(`HoldingsPage.tsx:55-58`),
   앱에서 분류를 바꿀 수는 없음. 이 동작은 tasks.md T055/T056 메모에 의도된 것으로 기록되어 있지만,
   spec Acceptance 2-3("즉시 반영")과는 다름.
4. **미매핑 종목의 수동 매핑 UI가 없음** (spec Clarification Q4, T057 미완료). 지금은 "미매핑"
   배지만 보임 (`HoldingDetailPanel.tsx:75`).
5. **판단 로그 Supabase 연결(T060~T064)은 코드 완료, 실DB 검증 대기.** 커밋 `056320c`로 코드와 테스트가
   들어왔고, 단위 테스트는 통과함(2026-10-17, 20개). 구성원 계정으로 DB 규칙을 확인하는 통합 테스트
   (`tests/integration/agenda-history.test.ts`)는 `QM_IT_*` 환경변수가 없어 실행된 적이 없음. tasks.md는
   T065 수동 점검 뒤에 완료 처리하기로 해서(Phase 9 진행 메모) 미체크로 둠. 불일치가 아니라 의도된 상태임.

## 3. 분석 이벤트

없음(2026-10-17 다시 확인). `index.html`에는 폰트 링크만 있고, `package.json`에도 analytics 의존성이
없으며, `src` 전체에서 `gtag`, `GA4`, `analytics`, `track` 같은 호출을 찾지 못함. 위 단계를 구분해서 측정할
수단이 현재는 없음. 다만 의견 0건 상태로 합의한 건은 `agreement_record.opinion_count_at_confirmation`으로
DB에 남고 앱도 이 값을 읽기 때문에(`supabaseAgendas.ts:103`), 그 횟수만은 이벤트 없이도 셀 수 있음.

## 4. 실데이터 노출 범위

"실데이터를 누출하지 않는다"는 누가 데이터를 볼 수 있느냐에 대한 규칙(접근 제한)이며,
실데이터를 다루지 않는다는 뜻이 아님.

| 장치 | 근거 | 하는 일 |
|---|---|---|
| anon 권한 전부 회수 | `supabase/migrations/20260927121301_rls_and_grants.sql:161-167` | 로그인하지 않은 요청은 어떤 테이블, 뷰, 함수에도 접근할 수 없음 |
| RLS 정책 | 같은 파일 `:16-148`, `is_household_member()` | 로그인한 사람도 자기 household의 데이터만 볼 수 있음 |
| 뷰에 `security_invoker = true` | `20260927121300_schema.sql:4-5` | 뷰를 조회해도 RLS가 우회되지 않고 그대로 적용됨 |
| 앱은 anon key만 사용 | `src/lib/supabase.ts:11-16` | 앱 쪽에는 service role key가 없음 |
| 공개용 뷰에 금액 컬럼 없음 | `20260927121300_schema.sql:193-200` | 비중(`weight_ratio`)만 있고 금액은 없음 (FR-004) |

실데이터는 Google Sheets에서 Apps Script(service role)로 Supabase에 동기화되고, 집계 뷰가
그 실데이터로 합계, 수익률, 비중을 계산함. tasks.md T055 메모에 실DB 조회 확인이 기록되어 있음.

| 환경 | 데이터 소스 | 근거 |
|---|---|---|
| GitHub Pages 배포 | mock으로 강제 | `.github/workflows/deploy.yml:20, 42-43`: mock이 아니면 빌드를 실패시킴 |
| 로컬 `.env.local` | mock | `VITE_DATA_SOURCE=mock` |
| supabase 모드로 실행할 때 | 대시보드, 계좌·종목, 판단 로그 모두 실데이터를 읽음. MSW는 켜지지 않음 (`src/main.tsx:6-10`) | `useDashboardSummary.ts`, `useAccounts.ts`, `useHoldingDetail.ts`, `useAgendas.ts`, `useAgendaDetail.ts` |

## 5. 이번 분석 대상: 판단 로그의 안건 작성 → 합의 확정

- 클릭, 검증 통과, 저장 성공, 결과 표시가 코드 안에서 서로 다른 지점으로 나뉘어 있어서 단계별
  흐름을 그리기 좋음. 분류 변경은 select를 고르는 순간 바로 제출되기 때문에 단계가 거의 없음.
- 10-10 분석 때는 클릭과 저장 성공이 실제로 어긋나 있었음(2절 해결됨 2번). 지금은 코드에서 두 단계가
  나뉘어 있으므로, 분석 이벤트를 붙일 때 `agenda_submit_click`과 `agenda_save_success`를 따로 둘 수 있음
  (AGENTS.md "사용자 행동과 저장").
- 주의할 점: 실사용 행동 데이터는 없으므로, 이 분석은 실사용이 아니라 구현된 동작을 기준으로 함.
- 이후 상용화 가정 분석(Activation, NSM, 퍼널, Retention)에서는 대상 Job을 "흩어진 자산을 한 번에
  보기"(부부 합계)로 옮김. 판단 로그는 NSM 보조 지표로 남음. 정리는 `docs/이름_20261017_11주차프로젝트.md`.

## 6. 코드만으로 알 수 없는 사용자 경험

1. 대시보드에서 실제로 어떤 숫자(나, 상대방, 부부 합계, 비중)를 보고 판단을 시작하는지, 그리고
   안건 요약을 보고 판단 로그로 넘어가려 하는지.
2. 분류가 시트 탭에서만 바뀐다는 사실을 두 운영자가 알고 있는지, 앱에서 select가 원래 값으로
   돌아갈 때 이를 어떻게 받아들이는지.
3. 실제 논의가 앱 안에서 이루어지는지, 아니면 메신저나 대면 대화 뒤에 결과만 기록하는지. 의견
   0건 합의의 횟수는 DB로 셀 수 있어도 그 이유는 알 수 없음.

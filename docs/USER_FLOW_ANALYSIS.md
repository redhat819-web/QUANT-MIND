# QUANT-MIND 사용자 흐름 분석

- 작성일: 2026-10-10
- 범위: 대시보드(`/dashboard`), 계좌·종목(`/holdings`), 판단 로그(`/judgment-log`)
- 방법: 코드와 문서만 읽고 정리함. 앱을 실행하거나 테스트를 돌리지는 않음.
- 정본: AGENTS.md가 없으므로 `specs/001-quant-mind-dashboard/spec.md`, `tasks.md`,
  `DESIGN.quantmind.md`를 정본으로 사용함.

## 1. 목적별 행동 흐름

| Job | 화면과 행동 순서 | 파일·함수 근거 | 확인 상태 |
|---|---|---|---|
| 흩어진 자산을 한 번에 보기 | 로그인하지 않았으면 `/login`으로 이동 → 로그인 후 원래 가려던 화면으로 복귀 → 기준 시점 → 나·상대방·부부 합계 → 성장/방어/현금 비중 → 논의 중인 안건 → 안내 문구 | `src/app/routes.tsx` (`/`가 `/dashboard`로 이동), `src/app/ProtectedRoute.tsx:16`, `src/pages/LoginPage.tsx:19-30`, `src/pages/DashboardPage.tsx:11-43`, `src/features/dashboard/hooks/useDashboardSummary.ts:20` | 코드로 확인. 대시보드의 안건 요약은 클릭되지 않아서 판단 로그로 가는 경로가 없음 (`AgendaSummaryList.tsx:18`) |
| 합계의 근거를 확인하고 분류 바로잡기 | 빠른 확인(계좌 요약) → 계좌 선택 → 상세 모드로 전환 → 종목 상세 → 분류 select 변경(선택이 곧 제출, 별도 저장 버튼 없음) → 저장 중 → 성공하면 대시보드 비중 쿼리를 다시 불러옴 | `src/pages/HoldingsPage.tsx:17-35`, `QuickModeToggle.tsx`, `ClassificationSelect.tsx:30`, `useHoldingDetail.ts:56-74` (71행에서 `dashboard-summary` 무효화) | 코드로 확인. supabase 모드에서는 저장이 무조건 거부됨 (`useHoldingDetail.ts:64-65`) |
| 투자 안건을 논의하고 합의 남기기 | [안건 작성] 클릭 → 제목·내용 입력 → zod 검증 → mutate 호출 → 저장 → 목록 다시 불러옴 → 안건 선택 → 의견 등록 → [합의 확정] → 확정자·시각·의견 수 표시 | `src/pages/JudgmentLogPage.tsx:45-70, 150-168`, `AgendaForm.tsx:28-41`, `src/lib/validation/agenda.ts`, `useAgendas.ts:41-46`, `useAgendaDetail.ts:81-97` | 코드로 확인. mock 전용이며 Supabase 연결 전 (T061·T062 미완료) |

### 단계 구분 (클릭, 검증, 저장 성공)

| 단계 | 안건 작성 | 분류 변경 |
|---|---|---|
| 입력 시작 | `setIsComposing` 토글 (`JudgmentLogPage.tsx:48`) | 상세 모드 진입 (`HoldingsPage.tsx:23`) |
| 유효 제출 | `agendaFormSchema.safeParse` 통과 (`AgendaForm.tsx:30`) | 해당 없음 (select라서 값이 항상 유효함) |
| 저장 요청 | `createAgenda.mutate` (`JudgmentLogPage.tsx:62`) | `updateClassification.mutate` (`HoldingsPage.tsx:34`) |
| 저장 성공 | `onSuccess` → `['agendas']` 무효화 | `onSuccess` → holdings·dashboard·accounts 무효화 |
| 결과 표시 | 목록에 새 안건 추가 | 대시보드로 돌아가면 비중 갱신 |

## 2. 코드와 문서가 다른 곳

1. **판단 로그는 mock에서만 동작함.** `useAgendas`·`useAgendaDetail`은 항상 `/mock-api`를
   호출하는데, supabase 모드에서는 MSW가 켜지지 않음 (`src/main.tsx:6-8`). 그래서 실데이터
   모드에서는 판단 로그가 동작하지 않음. 반면 대시보드의 "논의 중인 안건"은 supabase 모드에서
   실제 `agenda` 테이블을 읽음 (`supabaseDashboard.ts:140`). 두 화면이 서로 다른 데이터를 보게 됨.
2. **안건 작성 폼이 저장 성공 전에 닫힘.** mutate 직후 바로 `setIsComposing(false)`가 실행되고
   (`JudgmentLogPage.tsx:68`), 입력값도 바로 비워짐 (`AgendaForm.tsx:37-40`, 의견도
   `OpinionThread.tsx:27`). 저장에 실패하면 입력이 사라지고 오류도 표시되지 않음
   (`createAgenda.isError`를 화면에 그리는 곳이 없음). spec의 Edge Case "오류 상태를 표시하고
   재시도 가능"과 다름.
3. **분류 변경(FR-011)이 조용히 실패함.** supabase 모드에서는 저장이 거부되는데 오류를 화면에
   띄우지 않음. 그래서 select 값이 원래대로 돌아가기만 하고, "시트 종목분류 탭에서 변경" 안내
   문구는 사용자에게 보이지 않음. 이 동작은 tasks.md T055/T056 메모에 의도된 것으로 기록되어
   있지만, spec Acceptance 2-3("즉시 반영")과는 다름.
4. **미매핑 종목의 수동 매핑 UI가 없음** (spec Clarification Q4, T057 미완료). 지금은 "미매핑"
   배지만 보임.

## 3. 분석 이벤트

없음. `index.html`에는 폰트 링크만 있고, `package.json`에도 analytics 의존성이 없으며, `src`
전체에서 `gtag`, `GA4`, `analytics`, `track` 같은 호출을 찾지 못함. 위 단계를 구분해서 측정할
수단이 현재는 없음. 다만 의견 0건 상태로 합의한 건은 `opinionCountAtConfirmation`으로 DB에
남기 때문에, 그 횟수만은 이벤트 없이도 셀 수 있음.

## 4. 실데이터 노출 범위

"실데이터를 누출하지 않는다"는 누가 데이터를 볼 수 있느냐에 대한 규칙(접근 제한)이며,
실데이터를 다루지 않는다는 뜻이 아님.

| 장치 | 근거 | 하는 일 |
|---|---|---|
| anon 권한 전부 회수 | `supabase/migrations/20260927121301_rls_and_grants.sql:161-167` | 로그인하지 않은 요청은 어떤 테이블, 뷰, 함수에도 접근할 수 없음 |
| RLS 정책 | 같은 파일 `:16-148`, `is_household_member()` | 로그인한 사람도 자기 household의 데이터만 볼 수 있음 |
| 뷰에 `security_invoker = true` | `20260927121300_schema.sql:4-5` | 뷰를 조회해도 RLS가 우회되지 않고 그대로 적용됨 |
| 앱은 anon key만 사용 | `src/lib/supabase.ts:7-8` | 앱 쪽에는 service role key가 없음 |
| 공개용 뷰에 금액 컬럼 없음 | `20260927121300_schema.sql:193-200` | 비중(`weight_ratio`)만 있고 금액은 없음 (FR-004) |

실데이터는 Google Sheets에서 Apps Script(service role)로 Supabase에 동기화되고, 집계 뷰가
그 실데이터로 합계, 수익률, 비중을 계산함. tasks.md T055 메모에 실DB 조회 확인이 기록되어 있음.

| 환경 | 데이터 소스 | 근거 |
|---|---|---|
| GitHub Pages 배포 | mock으로 강제 | `.github/workflows/deploy.yml:20, 42-43`: mock이 아니면 빌드를 실패시킴 |
| 로컬 `.env.local` | mock | `VITE_DATA_SOURCE=mock` |
| supabase 모드로 실행할 때 | 대시보드와 계좌·종목은 실데이터를 읽음, 판단 로그는 여전히 mock | `useDashboardSummary.ts`, `useAccounts.ts`, `useHoldingDetail.ts`, `useAgendas.ts` |

## 5. 이번 분석 대상: 판단 로그의 안건 작성 → 합의 확정

- 클릭, 검증 통과, 저장 성공, 결과 표시가 코드 안에서 서로 다른 지점으로 나뉘어 있어서 단계별
  흐름을 그리기 좋음. 분류 변경은 select를 고르는 순간 바로 제출되기 때문에 단계가 거의 없음.
- 2절의 2번처럼 클릭과 저장 성공이 실제로 어긋나는 곳이 있어서, 둘을 구분해 볼 대상이 분명함.
- 다음 작업인 T061·T062(Supabase 연결) 전에 흐름을 정리해 두면 연결 작업 범위를 정하는 데
  바로 쓸 수 있음.
- 주의할 점: 현재는 mock에서만 동작하므로, 이 분석은 실사용이 아니라 구현된 동작을 기준으로 함.

## 6. 코드만으로 알 수 없는 사용자 경험

1. 대시보드에서 실제로 어떤 숫자(나, 상대방, 부부 합계, 비중)를 보고 판단을 시작하는지, 그리고
   안건 요약을 보고 판단 로그로 넘어가려 하는지.
2. 분류가 시트 탭에서만 바뀐다는 사실을 두 운영자가 알고 있는지, 앱에서 select가 원래 값으로
   돌아갈 때 이를 어떻게 받아들이는지.
3. 실제 논의가 앱 안에서 이루어지는지, 아니면 메신저나 대면 대화 뒤에 결과만 기록하는지. 의견
   0건 합의의 횟수는 DB로 셀 수 있어도 그 이유는 알 수 없음.

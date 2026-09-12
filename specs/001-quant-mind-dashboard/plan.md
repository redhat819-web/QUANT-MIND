# Implementation Plan: QUANT-MIND 공동 자산 관리 대시보드

**Branch**: `001-quant-mind-dashboard` | **Date**: 2026-09-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-quant-mind-dashboard/spec.md`

## Summary

두 운영자가 계좌 단위 → 개인 통합 → 부부 통합 3단계로 자산을 확인하고, 종목 분류를
수동 조정하며, 안건-의견-합의로 이어지는 판단 로그를 기록하는 웹 대시보드를
구현한다. 원본 자산 계산은 Google Sheets(GOOGLEFINANCE 포함)에 그대로 두고, Apps
Script가 표준화된 스냅샷을 Supabase Postgres로 전달한다. 프런트엔드는
React + Vite + TypeScript로 구성하고, 인증·데이터 저장·행 단위 접근 제어는 Supabase
Auth/Postgres/RLS로만 처리하며 별도 백엔드 서버는 두지 않는다. 협업(안건/의견/합의)
기능 이전에 Mock Data로 세 핵심 화면(대시보드, 계좌·종목 리스트, 판단 로그)의 UI를
먼저 완성하고 `/design-sync`로 디자인 정합성을 확인한 뒤, Sheets 어댑터(U5) →
Supabase 협업 기능(U4) 순서로 실제 데이터 연동을 진행한다.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Node.js 20 LTS (빌드 도구용)

**Primary Dependencies**: React 18, Vite 5, `@supabase/supabase-js` v2, React Router,
TanStack Query(서버 상태 캐싱), Zod(입력 검증 스키마), Vitest + Testing Library,
Playwright(E2E), MSW(Mock Service Worker — Mock Data 단계 및 테스트용)

**Storage**: Supabase PostgreSQL (스냅샷/안건/의견/합의 기록/매핑 정의 테이블 및 뷰),
Google Sheets는 원본 계산 소스로 유지되며 앱은 이를 직접 읽지 않고 Apps Script가
전달한 스냅샷만 사용

**Testing**: Vitest(단위/컴포넌트), React Testing Library(컴포넌트 상호작용),
Playwright(핵심 시나리오 E2E, 데스크톱·모바일 뷰포트), pgTAP 또는 SQL 스크립트
기반 RLS 정책 테스트

**Target Platform**: 모던 브라우저(데스크톱 + 모바일 웹, 반응형). 별도 네이티브
앱 없음

**Project Type**: Web application (SPA 프런트엔드 + BaaS, 별도 백엔드 서버 없음)

**Performance Goals**: 대시보드 초기 로드 후 5초 이내 3단계 집계·비중 표시(SC-001
근거), 일반 조작(분류 변경, 안건 작성)은 클릭 후 1초 이내 낙관적 UI 반영

**Constraints**: 별도 백엔드 서버 금지(Supabase 클라이언트 SDK + RLS로만 접근 제어),
Google Sheets 원본 수식·구조 변경 금지, 금액 데이터는 인증된 Supabase 세션 응답에서만
반환(헌장 원칙 II·III), 안건/의견 길이 제한(제목 1~100자, 내용/의견 1~2000자)

**Scale/Scope**: 사용자 2명(운영자) + 향후 공개 열람자(본 기능 범위 외), 계좌 수
개~십여 개, 종목 수 수십~수백 개 규모, 화면 3개(대시보드/계좌·종목 리스트/판단 로그)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 원칙 | 이번 계획에서의 반영 방식 | 상태 |
|---|---|---|
| I. 동등한 운영자 권한 | RLS는 "같은 household 소속"만으로 판단하며 role/admin 컬럼을 두지 않음. 안건 수정은 작성자 본인 한정이지만 이는 상하 구조가 아니라 저작권 개념(양쪽 모두 동일 규칙 적용) | PASS |
| II. 인증 세션 전용 금액 반환 | 금액 컬럼은 인증된 세션 하의 household 스코프 테이블/뷰에서만 SELECT 가능하도록 RLS로 강제. 프런트 숨김 방식 사용 안 함 | PASS |
| III. 공개 화면 데이터의 금액 배제 | 공개용 `public_allocation_view`는 금액 컬럼 자체를 SELECT 목록에 포함하지 않도록 스키마 단계에서 설계(§10). 이번 기능은 뷰 설계까지만, 화면 구현은 범위 외 | PASS |
| IV. 비밀정보의 환경변수 전용 관리 | Supabase URL/anon key는 Vite `.env` 변수로, service role key는 Apps Script 프로젝트 속성(PropertiesService)으로만 관리. 코드/레포에 하드코딩 금지 | PASS |
| V. 참고용 고지 문구 | 대시보드 등 분석 화면 공통 레이아웃에 고정 문구 컴포넌트 배치 | PASS |
| VI. 시나리오 제시 원칙 | 이번 기능에는 AI 분석/시나리오 생성 없음(MVP 제외). 문구·카피에 확정적 투자 권유 표현 사용 금지만 검수 대상 | PASS |
| VII. 판단 기록의 작성자·시각 기록 | agenda/opinion 테이블에 `author_id`, `created_at` NOT NULL 제약 | PASS |
| VIII. 합의 확정 기록의 변경 이력 보존 | `agenda_history` 테이블에 수정 전 값·수정자·수정 시각·사유를 append-only로 기록 | PASS |
| IX. 원본 스프레드시트 형식 존중 | Google Sheets 원본은 변경하지 않고, Apps Script가 각자의 열 구성을 표준 페이로드로 변환. `mapping_rule` 테이블이 종목 표기 차이를 흡수 | PASS |
| X. 조건부 표시 항목의 빈 상태 견고성 | holdings 테이블의 조건부 컬럼은 전부 nullable, 프런트는 null을 "데이터 없음"으로 렌더링(§9) | PASS |
| XI. 명세 범위 준수 | 공개 화면 구현, 종목 차트, AI 분석 등은 明시적으로 이번 계획에서 제외 | PASS |
| XII. 세 화면 디자인 일관성 | 공통 레이아웃/디자인 토큰을 `components/layout`, `styles/tokens`로 공유, `/design-sync`로 3화면 일관성 검증(§15) | PASS |
| XIII. 상태의 색상+텍스트 이중 표현 | 상태 배지 컴포넌트(`StatusBadge`)는 색상 + 텍스트 라벨을 항상 함께 렌더링하도록 공통 컴포넌트화 | PASS |
| XIV. 모션 감소 설정 존중 | 전역 CSS에 `prefers-reduced-motion` 미디어 쿼리로 트랜지션 무력화 규칙 적용 | PASS |
| XV. 데스크톱·모바일 핵심 시나리오 완결성 | Playwright E2E를 데스크톱/모바일 뷰포트 두 세트로 실행 | PASS |
| XVI. Task의 요구사항·디자인 추적성 | tasks.md의 각 Task에 FR-ID/SC-ID 및 디자인 근거(quickstart.md, data-model.md 절) 참조 필수 | PASS (프로세스 규칙, `/speckit-tasks` 단계에서 적용) |
| XVII. 실패한 테스트·빌드의 완료 처리 금지 | CI 게이트(§13)에서 vitest+playwright+build 실패 시 Task 완료 처리 차단 | PASS |
| XVIII. DESIGN.md(Kraken)를 UI 기본 시각 기준으로 채택 | `src/styles/tokens.css`의 색상/타이포 값이 `DESIGN.md`(Kraken)를 출발점으로 설정됨. 다만 세 화면 전체를 `DESIGN.md`와 항목별로 대조하는 공식 검증은 아직 수행되지 않음(Phase 6 `/design-sync`에서 수행 예정) | PASS (조건부, Phase 6 재확인, `src/styles/tokens.css`) |
| XIX. DESIGN.md 원본 불변 | `DESIGN.md` 파일은 이번 계획·구현 전 과정에서 수정된 적 없음(읽기 전용 참조로만 사용) | PASS (근거: `DESIGN.md` — 변경 이력 없음) |
| XX. DESIGN.quantmind.md의 우선순위와 충돌 기록 | `DESIGN.quantmind.md`가 이미 존재하며 등락 색상·서체 대체 등 `DESIGN.md`와의 차이와 그 근거를 문서 내에 기록하고 있음 | PASS (근거: `DESIGN.quantmind.md`) |
| XXI. 등락 색상 규칙(상승 빨강 / 하락 파랑) | `tokens.css`에 `--color-rise`/`--color-fall`(및 라이트·다크 변형) 토큰 정의, `format.ts`의 `returnRateToneClass`가 이를 적용해 4개 화면(개인/가계 수익률, 계좌 요약, 종목 상세)에 연결됨 | PASS (근거: `src/styles/tokens.css`, `src/lib/format.ts`) |
| XXII. 시스템 상태와 시장 데이터의 색 체계 분리 | `StatusBadge.tsx`의 tone은 `neutral/success/error/warning`으로 시스템 상태 전용이며, 등락 표시는 `.num`/`.num--rise`/`.num--fall` 유틸리티 클래스를 사용하는 별도 경로로 분리되어 컴포넌트를 공유하지 않음 | PASS (근거: `src/components/ui/StatusBadge.tsx`, `src/styles/tokens.css`) |
| XXIII. 전용 상표 폰트·브랜드 자산 비복제 | Kraken 전용 폰트(Kraken-Brand/Kraken-Product) 대신 라이선스가 명확한 Pretendard Variable을 CDN으로 로드해 사용 | PASS (근거: `index.html`) |
| XXIV. 수치 표기 형식(tabular figures·우측 정렬·고정 소수점) | `.num` 유틸리티 클래스가 `font-variant-numeric: tabular-nums`와 `text-align: right`를 적용하며, `format.ts`의 포맷터가 고정 소수점 자리수를 강제함 | PASS (근거: `src/styles/tokens.css`, `src/lib/format.ts`) |

위반 없음(XVIII은 Phase 6에서 재확인) → Complexity Tracking 불필요.

## Design Reference

이 기능의 모든 시각 구현(`src/styles/tokens.css` 및 이를 사용하는 컴포넌트)은 다음
두 문서를 근거로 한다(헌장 원칙 XVIII–XX):

- **`DESIGN.md`**(리포지토리 루트, 코드네임 Kraken): UI 기본 시각 기준(타이포그래피,
  색상, 레이아웃 그리드, 컴포넌트 스타일)의 출발점. **원본 파일은 수정하지 않는다**
  (헌장 원칙 XIX).
- **`DESIGN.quantmind.md`**(리포지토리 루트): 이 프로젝트 전용 오버레이 문서로,
  `DESIGN.md`보다 **우선 적용**된다(헌장 원칙 XX). 등락 색상 규칙(상승 빨강/하락
  파랑), Kraken 전용 폰트 대체(Pretendard Variable), 수치 표기 형식(tabular
  figures) 등 `DESIGN.md`와 다르게 정한 항목과 그 충돌 근거를 이 문서 안에 기록한다.

`tokens.css`에 새 토큰이나 컴포넌트 스타일을 추가할 때는 먼저 `DESIGN.md`를 확인하고,
프로젝트 사정으로 벗어나야 한다면 `DESIGN.md`를 고치는 대신 `DESIGN.quantmind.md`에
그 예외와 이유를 추가한다.

## Project Structure

### Documentation (this feature)

```text
specs/001-quant-mind-dashboard/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── supabase-schema.sql
│   ├── rls-policies.sql
│   ├── apps-script-payload.md
│   └── public-allocation-view.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
quantmind/
├── src/
│   ├── app/
│   │   ├── App.tsx                 # 라우터, 전역 Provider(Query, Auth, Mock 스위치)
│   │   ├── routes.tsx              # /dashboard, /holdings, /judgment-log, /login
│   │   └── providers/
│   │       ├── AuthProvider.tsx
│   │       └── DataSourceProvider.tsx   # mock vs supabase 전환 스위치
│   ├── pages/
│   │   ├── DashboardPage.tsx
│   │   ├── HoldingsPage.tsx
│   │   ├── JudgmentLogPage.tsx
│   │   └── LoginPage.tsx
│   ├── features/
│   │   ├── dashboard/
│   │   │   ├── components/          # PersonalAggregateCard, HouseholdAggregateCard,
│   │   │   │                        # AllocationChartLegend, AgendaSummaryList
│   │   │   ├── hooks/               # useDashboardSummary
│   │   │   └── api/                 # supabase 쿼리 + mock 어댑터
│   │   ├── holdings/
│   │   │   ├── components/          # AccountSummaryTable, HoldingDetailPanel,
│   │   │   │                        # ClassificationSelect, QuickModeToggle
│   │   │   ├── hooks/               # useAccounts, useHoldingDetail
│   │   │   └── api/
│   │   └── judgment-log/
│   │       ├── components/          # AgendaForm, AgendaList, OpinionThread,
│   │       │                        # AgreementConfirmButton
│   │       ├── hooks/               # useAgendas, useAgendaDetail
│   │       └── api/
│   ├── components/
│   │   ├── layout/                  # AppShell, NavBar, DisclaimerBanner
│   │   └── ui/                      # Button, Card, EmptyState, ErrorState,
│   │                                 # LoadingState, StatusBadge — 시스템 상태 전용
│   │                                 # 단일 출처(src/components/ui/StatusBadge.tsx).
│   │                                 # 다른 위치에서 재구현하지 않는다(헌장 원칙 XXII)
│   ├── lib/
│   │   ├── supabaseClient.ts
│   │   ├── validation/               # zod 스키마 (agenda, opinion 길이 규칙)
│   │   └── format.ts                 # 통화/수익률 표시 포맷터
│   ├── mocks/
│   │   ├── fixtures/                 # accounts.json, holdings.json, agendas.json
│   │   ├── handlers.ts               # MSW 핸들러
│   │   └── browser.ts
│   ├── types/
│   │   └── domain.ts                 # Account, Holding, PersonalAggregate,
│   │                                 # HouseholdAggregate, Agenda, Opinion, AgreementRecord
│   └── styles/
│       └── tokens.css                # 색상/타이포/간격 토큰, prefers-reduced-motion 규칙
│                                      # (근거: DESIGN.md + DESIGN.quantmind.md, 아래
│                                      #  "Design Reference" 절 참조)
│
├── supabase/
│   ├── migrations/                   # 스키마/뷰/RLS 마이그레이션 SQL
│   └── config.toml
│
├── apps-script/
│   ├── src/
│   │   ├── syncSnapshot.gs           # 시트 → 표준 페이로드 변환 및 Supabase 전송
│   │   └── mappingHelpers.gs
│   └── appsscript.json
│
├── tests/
│   ├── unit/                         # 포맷터, 검증 스키마, 가중 평균 계산(프런트 표시용)
│   ├── integration/                  # supabase 쿼리 계약 테스트(테스트 프로젝트 대상)
│   └── e2e/                          # Playwright: 대시보드/리스트/판단 로그 시나리오
│
├── .env.example
├── vite.config.ts
├── package.json
└── tsconfig.json
```

**Structure Decision**: 별도 백엔드가 없는 단일 프런트엔드(React SPA) + BaaS(Supabase)
+ 외부 배치 스크립트(Apps Script) 구조. `frontend/backend` 2트리 옵션 대신 리포지토리
루트에 `src/`(SPA), `supabase/`(스키마·정책 as code), `apps-script/`(동기화 스크립트)
세 개의 최상위 디렉터리를 두어, "별도 백엔드 서버 없음" 제약과 헌장 원칙 IX(원본
스프레드시트 존중)를 구조적으로 드러낸다.

## Complexity Tracking

> 위반 없음 — 이 표는 비워 둔다.

# Phase 0 Research: QUANT-MIND 공동 자산 관리 대시보드

기술 구조(React/Vite/TS/Supabase/Apps Script)는 사용자가 확정해 전달했으므로, 이
문서는 "무엇을 쓸지"가 아니라 "어떻게 조합할지"에 대한 결정 사항을 기록한다.
NEEDS CLARIFICATION 항목은 없다.

## 1. 가중 평균 계산 위치 (DB 뷰 vs 애플리케이션 레이어)

**Decision**: 개인 통합/부부 통합의 가중 평균 계산은 Supabase **DB 뷰(SQL)** 에서
수행한다. 프런트엔드는 계산된 결과를 그대로 조회만 한다.

**Rationale**:
- 계산 로직이 한 곳(DB)에만 존재하면 화면이 늘어나도(대시보드 외 향후 위젯 등)
  같은 숫자를 재계산 없이 재사용할 수 있다.
- RLS와 동일한 레이어에서 접근 제어와 계산이 함께 이루어지므로, "인증 세션에서만
  금액 반환"(헌장 원칙 II) 검증 지점이 단순해진다(뷰 자체가 이미 household
  스코프로 필터링됨).
- 클라이언트에서 재계산하면 두 운영자의 화면에서 반올림/타이밍 차이로 서로 다른
  숫자가 보일 위험이 있다.

**Alternatives considered**:
- 애플리케이션 레이어(React 쿼리 훅) 계산: 초기 구현은 빠르지만, 향후 화면이
  늘어날 때 계산 로직 중복 및 불일치 위험이 커서 기각.
- Edge Function(서버리스 함수)에서 계산: "별도 백엔드 서버 없음" 제약과 상충하지는
  않지만(Supabase 관리형 기능이므로), 이번 규모(계좌 수십 개)에서는 SQL 뷰만으로
  충분해 추가 배포 단위를 늘릴 이유가 없어 기각.

## 2. Supabase RLS 설계 (household 단위, 관리자 없음)

**Decision**: `household_members(user_id, household_id)` 매핑 테이블을 두고, 모든
자산·안건 테이블은 "요청자의 household_id와 행의 household_id가 같으면 SELECT/INSERT
허용"이라는 단일 정책 함수(`is_household_member(household_id)`)로 통일한다. role
컬럼이나 `is_admin` 플래그는 어떤 테이블에도 두지 않는다.

**Rationale**: 헌장 원칙 I(동등 권한)을 스키마 수준에서 강제하는 가장 단순한 방법은
애초에 권한 차등을 표현할 컬럼 자체를 만들지 않는 것이다.

**Alternatives considered**: 사용자별 개별 정책(운영자 A/B를 이름으로 분기) — 두
사람만 있는 지금은 동작하지만 하드코딩이며, household 개념을 두면 향후 계정 교체나
테스트 계정 추가 시에도 정책 변경이 필요 없어 household 매핑 방식을 채택.

## 3. Google Sheets → Apps Script → Supabase 동기화 방식

**Decision**: Apps Script의 시간 기반 트리거로 `syncSnapshot` 함수를 **매일 저녁
7시(한국 시간, Asia/Seoul) 1회** 실행해, 시트 값(GOOGLEFINANCE 계산 결과 포함)을
표준 JSON 페이로드로 변환한 뒤 Supabase REST API(PostgREST)에 service role key로
upsert한다. 운영자가 그 사이 값을 즉시 최신화하고 싶을 때를 위해 스프레드시트
메뉴의 "지금 동기화" 수동 실행 항목은 그대로 유지한다.

**Rationale**: 하루 여러 번(1일 4회) 갱신하는 것은 이 제품의 사용 패턴(하루 한
번 정도 자산을 확인하고 논의하는 부부 도구)에 비해 과도하다고 재판단했다. 저녁
7시는 국내 정규장(코스피/코스닥) 마감 이후 종가가 확정되고, 해외 상장 자산이
섞여 있어도 그날 하루의 "확정된" 스냅샷을 안정적으로 가져올 수 있는 시간대다.
자동 갱신 주기를 줄이는 대신, 수동 "지금 동기화"를 유지해 운영자가 필요할 때
즉시 최신화할 수 있는 경로를 남겨 둔다. 자동/수동 어느 경로로 갱신되었든
대시보드에는 실제 반영 시각을 그대로 노출해야 하므로(§ spec.md FR-024, 아래
"동기화 상태 노출" 참고), 주기를 줄여도 데이터가 언제 기준인지 사용자가 오인할
위험은 없다.

**Alternatives considered**:
- 1일 4회 시간 트리거(기존 검토안): 장 중 변동을 더 자주 반영할 수 있지만, 이
  도구의 목적(하루 단위로 논의)에 비해 API 호출과 운영 복잡도만 늘어나 폐기.
- Google Sheets 변경 시 자동 트리거(`onEdit`): 대량 수식 재계산(GOOGLEFINANCE)
  중 매 셀 변경마다 실행되어 API 호출이 과다해질 수 있어 기각.
- Webhook 기반 실시간 연동: 별도 상시 서버가 필요해 "별도 백엔드 서버 없음"
  제약에 위배되어 기각.

**동기화 상태 노출**: 자동(저녁 7시)이든 수동이든, 각 동기화 시도는 성공/실패와
반영 시각을 Supabase에 기록하고(§ data-model.md `account.last_synced_at`,
`last_sync_status`, `last_sync_error`), 대시보드는 household 전체 기준으로 가장
오래된(=가장 보수적인) 동기화 시각을 "기준 시점"으로 항상 표시한다(FR-024).
이는 헌장 원칙 X(빈 상태 견고성)와 별개로, "지금 보는 숫자가 언제 기준인지"를
숨기지 않는다는 점에서 원칙 II·III(금액은 숨기지 않고 명확한 경계로 통제)의
투명성 취지와도 일관된다.

## 4. Mock Data 기반 UI 우선 구현 전략

**Decision**: `DataSourceProvider`가 환경 변수(`VITE_DATA_SOURCE=mock|supabase`)에
따라 동일한 훅 인터페이스(`useAccounts`, `useDashboardSummary`, `useAgendas` 등)
뒤에서 MSW 기반 mock 핸들러 또는 실제 Supabase 클라이언트를 주입한다. 세 화면은
mock 모드로 먼저 완성 및 검증하고, 이후 어댑터만 교체한다.

**Rationale**: 화면/컴포넌트 코드가 데이터 출처를 몰라도 되도록 인터페이스를
고정하면, Supabase 스키마가 나중에 미세 조정되어도 UI 코드를 다시 손댈 필요가
없다. 사용자가 명시적으로 요구한 "데이터 연결 전 Mock Data로 화면 먼저 검증"
흐름과도 일치한다.

**Alternatives considered**: Storybook만으로 컴포넌트 단위 검증 — 화면 전체 흐름
(로딩→데이터→상호작용) 검증에는 부족해 MSW 기반 통합 mock을 채택.

## 5. `/design-sync` 실행 시점

**Decision**: Mock Data 기반으로 세 핵심 화면(대시보드/계좌·종목 리스트/판단 로그)의
UI 구현이 끝나고 로컬에서 목업 데이터로 정상 동작함을 확인한 직후, 실제 데이터
연동(Sheets 어댑터, Supabase 협업 기능) 작업을 시작하기 **전에** `/design-sync`를
1회 실행한다. 범위는 세 화면의 정보 구조·컴포넌트 일관성(헌장 원칙 XII)과 상태
표시 규칙(원칙 XIII), reduced-motion 대응(원칙 XIV) 점검으로 한정한다.

**Rationale**: 실제 데이터 연동 전에 디자인 불일치를 잡아야 이후 어댑터 교체
작업이 이미 검증된 UI 위에서 이루어져, 데이터 연동과 디자인 수정이 뒤섞이지 않는다.
사용자가 명시한 "UI 구현 → `/design-sync` → Sheets 어댑터(U5) → Supabase 협업
기능(U4)" 순서와 일치한다.

## 6. 테스트 전략 개요

**Decision**: (a) Vitest로 순수 로직(포맷터, zod 검증 스키마, 프런트 표시용 보조
계산)을 단위 테스트, (b) React Testing Library로 컴포넌트가 로딩/빈 목록/오류/권한
없음/저장 중/데이터 없음 6개 상태(FR-023)를 올바르게 렌더링하는지 검증, (c) SQL
기반 RLS 정책 테스트로 household 간 데이터 격리를 검증, (d) Playwright E2E로 세
User Story의 Given-When-Then을 데스크톱·모바일 뷰포트 각각에서 실행.

**Rationale**: 헌장 원칙 XVII(실패한 테스트/빌드는 완료 처리 금지)을 만족하려면
각 계층(로직/컴포넌트/DB 정책/전체 흐름)이 독립적으로 실패를 드러낼 수 있어야
한다.

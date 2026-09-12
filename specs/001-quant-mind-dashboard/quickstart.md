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
npm run dev                  # http://localhost:5173

# 단위/컴포넌트 테스트
npm run test                 # vitest

# E2E (데스크톱 + 모바일 뷰포트)
npm run test:e2e             # playwright

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

## 4. Supabase 협업 기능(U4) 연동 검증

1. 두 개의 테스트 계정으로 로그인해, 서로 상대방의 안건에 의견을 남길 수 있는지
   (FR-003), 작성자만 "논의중" 안건을 수정할 수 있는지(FR-016a) 확인.
2. 의견 0건 상태에서 합의 확정이 성공하는지(FR-019) 확인.
3. 합의완료된 안건을 수정 시도해, `agenda_history`에 이전 값이 남고 원본이
   덮어써지지 않는지(FR-021) SQL로 직접 확인.
4. 로그인하지 않은 상태(anon key만 사용)로 위 테이블들을 직접 조회해, 금액/안건
   데이터가 전혀 반환되지 않는지(FR-002, FR-004, 헌장 원칙 II) 확인.
5. Playwright E2E 전체 스위트(mock 아님, 실제 Supabase 테스트 프로젝트 대상)를
   데스크톱·모바일 뷰포트로 실행해 통과 확인(헌장 원칙 XV, XVII).

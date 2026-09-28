# Phase 8~9 (T049~T065) 사전 준비 초안

- 조사일: 2026-09-26 / 갱신일: 2026-09-27 (T049~T054 실제 착수 반영)
- 목적: T047~T070 중 Phase 8(Sheets 어댑터, U5)·Phase 9(Supabase 협업, U4)를
  착수하기 전, 무엇이 선행되어야 하고 어떤 외부 계정/시크릿이 필요한지 미리
  정리한다.

**2026-09-27 갱신**: 초안 작성 시점엔 "테스트용 스프레드시트 사본"을 전제했으나,
실제로는 **원본 파일 "스마트 주식 데이터"를 그대로 사용**하기로 결정했다(사본
생성 안 함). 대신 보안 규칙으로 대응: Apps Script는 `SPREADSHEET_ID` 스크립트
속성의 파일 하나만 열고(`openAllowedSpreadsheet_`), `getSheets()`로 탭 목록을
조회하지 않으며, 지정된 3개 탭(포트폴리오/배우자_주식현황/배우자_자산)만 이름으로
읽는다. 기존 웹앱(Family AI v18.2)과 `Portfolio_Log_v2`는 참조하지 않는다.
아래 §2.1의 "테스트용 스프레드시트 사본" 항목은 이 결정으로 대체되었다.

## 1. T049~T065 의존 관계 표

| Task | 내용 | 선행 Task | 외부 준비물 필요 |
|---|---|---|---|
| T049 ✅ | Supabase 프로젝트("Moamind")에 스키마 적용(테이블, 뷰, 트리거) — `security_invoker`/평균매입가 null 제외 조건까지 확장 | — (최초 착수 지점) | O — 완료(Supabase 프로젝트 + CLI) |
| T050 ✅ | RLS 적용 + anon 전체 권한 회수, authenticated만 명시 GRANT — anon 401 검증 완료 | T049 | O — 완료 |
| (추가) ✅ | **owner_type(member/joint/child) 스키마 확장** + **`upsert_snapshot` RPC 신설** — 원 계약(`contracts/`)엔 없던, T051 착수 중 필요해진 마이그레이션 2건. C7 결정 기준 수익률 공식(`(Σ평가금액−Σ매입원가)÷Σ매입원가`, `holding.cost_krw` 신설)도 이때 반영 | T049, T050 | O — 완료(`20260927130000_owner_type.sql`, `20260927140000_upsert_snapshot.sql`) |
| T051 ✅ | `apps-script/src/syncSnapshot.gs` 등 구현(시트 읽기 → 페이로드 변환 → `upsert_snapshot` RPC), clasp push 완료 | T049, 위 추가 마이그레이션 | O — 완료. 원본 시트 "스마트 주식 데이터" + Apps Script "Moamind Sync" 사용(사본 아님) |
| T052 ✅ | `mapping_rule` 조회·`security_key`/`is_mapped` 결정(FR-015) — **구현 위치를 Apps Script에서 `upsert_snapshot` SQL 함수(서버 측)로 변경** | 위 추가 마이그레이션 | 없음(SQL 함수 내부 로직) |
| T053 ✅ | 시간 기반 트리거(매일 19:00 Asia/Seoul, `ensureDailyTrigger()`) + "지금 동기화" 커스텀 메뉴(`onOpen()`) | T051 | 없음(코드에 포함, clasp push 완료) |
| T054 ✅ | 실패 처리 — 탭 읽기 실패는 전체 중단+Stackdriver 로그, 블록/합계 불일치는 해당 계좌만 `sync_status='failed'`로 payload에 포함 | T051 | 없음 |
| T055 | Supabase 어댑터 구현(`useAccounts`/`useHoldingDetail`/`useDashboardSummary` → 뷰 조회) | T049, T050(뷰·RLS가 있어야 조회 가능) | O — 프런트에서 실제 테스트하려면 `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` 필요(코드 자체는 로컬 목업으로도 타입 수준 작성 가능) |
| T056 | `DashboardPage`/`SyncStatusBanner`를 Supabase 어댑터에 연결(FR-024) | T055 | T055와 동일 |
| T057 | `HoldingsPage`를 Supabase 어댑터에 연결 + 수동 매핑 등록 UI(`mapping_rule` INSERT) | T055 | T055와 동일 |
| T058 | RLS 통합 테스트(household 스코프, anon 요청 시 금액 컬럼 미노출) | T049, T050 | O — 테스트 실행 시 Supabase URL + anon key(및 테스트용 계정) 필요. CI에서 돌리려면 GitHub Secrets 등록 필요 |
| T059 | quickstart.md §3 수동 실행(실제 시트 동기화 → 미매핑 노출 확인) | T051~T057 전체 | O — 실제 스프레드시트, Apps Script, Supabase 프로젝트 모두 살아있어야 함 |
| T060 | `agenda`/`opinion`/`agreement_record`/`agenda_history` 스키마·RLS·트리거 검증(T049/T050에 이미 포함, 보정만) | T049, T050 | 없음(검증 작업, 이미 있는 프로젝트 재사용) |
| T061 | Supabase 어댑터 구현(`useAgendas`/`useAgendaDetail` CRUD) | T060 | O — T055와 동일하게 실제 조회/변경 테스트 시 Supabase URL/anon key 필요 |
| T062 | `JudgmentLogPage` 연결 — "논의중" + 작성자 본인만 수정을 RLS + UI 양쪽에서 강제 | T061 | T061과 동일 |
| T063 | `AgreementConfirmButton`을 `agreement_record` INSERT에 연결(의견 0건 허용) | T061 | T061과 동일 |
| T064 | 통합 테스트 — 합의완료 안건 수정 시 `agenda_history` append, 원본 미변경 검증 | T060, T061 | O — 실제 Supabase 프로젝트(또는 테스트 전용 프로젝트) |
| T065 | quickstart.md §4 수동 실행(두 테스트 계정 교차 의견, 의견 0건 확정, anon 조회 차단 확인) | T061~T064 전체 | O — 테스트 계정 2개 + 로그인 흐름까지 완성되어 있어야 함 |

**요약**: T049/T050이 두 Phase 전체의 공통 선행 작업이다. Phase 8(T051~T059)과
Phase 9(T060~T065)는 스키마 적용 이후로는 서로 독립적으로 병행 가능하지만,
T060이 "T049/T050에 이미 포함된 정의를 재확인"하는 성격이라 실질적으로는
Phase 8을 먼저 끝내고 Phase 9로 넘어가는 순서가 자연스럽다.

## 2. 사전 준비물 체크리스트 (계정 · 시크릿 이름 · 넣을 위치만 — 값은 다루지 않음)

### 2.1 필요한 계정 · 프로젝트

- [ ] Supabase 프로젝트 1개 (신규 또는 기존 지정) — `contracts/supabase-schema.sql`,
      `contracts/rls-policies.sql` 적용 대상
- [X] Google 계정 + 원본 스프레드시트 "스마트 주식 데이터"(사본 아님, 위 갱신
      내용 참조) — Apps Script 독립 프로젝트 "Moamind Sync"(스크립트 ID는
      스크립트 속성/`.clasp.json`에만 존재, 이 문서엔 기록하지 않음)를 연결함
- [ ] (선택, T058/T064/T065 자동화 시) 테스트 전용 Supabase 프로젝트 또는 테스트
      스키마 — CI에서 통합 테스트를 돌리려면 실제 값이 필요하므로, 운영
      프로젝트와 분리하는 것을 권장
- [ ] 판단 로그 교차 검증(T065)을 위한 **테스트 운영자 계정 2개**(mock 로그인이
      아닌 실제 인증 흐름 대상)

### 2.2 필요한 키 · 시크릿 (이름과 넣을 위치만)

| 이름 | 용도 | 넣을 위치 | 비고 |
|---|---|---|---|
| `VITE_SUPABASE_URL` | 프런트가 Supabase REST/RPC를 호출할 프로젝트 URL | `.env.local`(로컬 개발), 필요 시 GitHub Actions 빌드 시크릿 | `.env.example`에 이미 키만 정의돼 있음, 값은 비공개 |
| `VITE_SUPABASE_ANON_KEY` | 프런트 전용 anon key(RLS로 제한됨) | `.env.local`, GitHub Actions 시크릿 | anon key만 프런트에 노출 가능(헌장 원칙 IV) |
| Supabase **service role key** | Apps Script → Supabase RPC(`upsert_snapshot`, `upsert_sync_status`) 인증, RLS 우회 | **Apps Script 프로젝트의 스크립트 속성(PropertiesService)**, 키 이름 `SUPABASE_SERVICE_ROLE_KEY` — `.env`/레포/프런트 코드에는 절대 두지 않음 | `contracts/apps-script-payload.md` §인증 참조. 완료: script property로 등록됨 |
| `SUPABASE_URL` | Apps Script가 PostgREST RPC를 호출할 URL(프런트의 `VITE_SUPABASE_URL`과 값은 같지만 별도 속성으로 관리) | Apps Script 스크립트 속성 | 완료 |
| `SPREADSHEET_ID` | Apps Script가 열어도 되는 유일한 스프레드시트 ID | Apps Script 스크립트 속성 | 완료. 코드(`Config.gs`)는 이 속성을 통해서만 읽고, 값 자체는 코드/레포에 없음 |
| `HOUSEHOLD_ID` | 이 앱이 다루는 단일 household의 UUID(`upsert_snapshot` payload에 포함) | Apps Script 스크립트 속성 | 완료 |
| `ME_USER_ID` / `SPOUSE_USER_ID` | 포트폴리오/배우자 탭 데이터를 어느 Supabase auth 사용자(uuid)에게 귀속시킬지 — **이메일이 아닌 UUID**로 관리(코드에 이메일 없음) | Apps Script 스크립트 속성 | 완료. 아직 실제 auth 사용자가 없다면(로그인 기능 미착수) 이 값은 나중에 채워야 실제 동기화가 성공한다 |
| (선택) CI용 테스트 Supabase URL/anon key/service role key | T058(RLS 통합 테스트)·T064(agenda-history 통합 테스트)를 CI에서 자동 실행하려는 경우 | **GitHub repository/organization Secrets**(예: `TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY`, `TEST_SUPABASE_SERVICE_ROLE_KEY`) | 이름은 예시이며 실제 도입 시 확정. `deploy.yml`과는 별도 워크플로(테스트 전용)로 분리 권장 — 배포 워크플로는 T083에 따라 `VITE_DATA_SOURCE=mock` 고정 유지 |

### 2.4 계좌명이 들어가는 값 (스크립트 속성, JSON — 코드/레포엔 없음)

계좌명이 저장소에 남지 않도록 코드 상수가 아니라 Apps Script 스크립트 속성에
JSON으로 저장한다. 속성이 없으면 빈 값으로 처리된다.

- `CHILD_ACCOUNT_NAMES` (JSON 배열): 포트폴리오 탭에서 자녀 계좌로 인식할 계좌명
- `BOARD_TO_BLOCK_ACCOUNT` (JSON 객체): Account Board 계좌명 → 블록 제목 계좌명 매핑
- `SPOUSE_CASH_ALLOWLIST` (JSON 배열): 배우자_자산 탭에서 읽을 항목명 허용 목록
- 세 값 모두 실행 전 Apps Script 프로젝트 설정 → 스크립트 속성에 채워야 실제
  데이터가 반영된다. `BOARD_TO_BLOCK_ACCOUNT`는 매핑이 필요한데 비어 있으면
  동기화가 "매핑 필요" 오류로 멈춘다(조용히 무시하지 않음).

### 2.3 주의사항 (헌장 원칙 IV 관련)

- service role key는 어떤 경우에도 `.env`, 프런트 번들, 커밋된 파일에 두지
  않는다 — Apps Script 스크립트 속성에만 저장.
- `.env.local`은 이미 `.gitignore`에 포함되어 있는지 재확인 필요(T068에서 다시
  점검 예정).
- 이 문서에는 실제 URL/키 값을 기록하지 않았고, 앞으로도 기록하지 않는다 —
  이름/위치만 문서화 대상이다.

## 3. 남은 미검증 항목 (T059 실행 전 확인 필요)

- `HOUSEHOLD_ID`/`ME_USER_ID`/`SPOUSE_USER_ID`가 실제 존재하는 household/auth
  사용자를 가리키는지 — 아직 U4(인증) 착수 전이라 auth.users에 실사용자가 없다면
  이 값들이 가리키는 대상이 없어 `upsert_snapshot`의 FK 제약(`account`의 참조)에
  걸려 실패할 수 있다.
- Account Board(예수금)/환율표 탐지 로직은 실제 시트 구조를 보지 못한 채 세운
  가정이다 — 처음 `지금 동기화`를 실행했을 때 Stackdriver 로그에
  `Account Board 헤더를 찾지 못함` 같은 오류가 없는지 확인 필요.
- `CHILD_ACCOUNT_NAMES`/`SPOUSE_CASH_ALLOWLIST` 스크립트 속성이 비어 있으면
  자녀 계좌는 전부 "member"로, 배우자 현금성 자산은 전혀 반영되지 않는다 —
  실제 값을 스크립트 속성에 채워야 함.

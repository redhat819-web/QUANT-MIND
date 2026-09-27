# Phase 8~9 (T049~T065) 사전 준비 초안

- 조사일: 2026-09-27
- 목적: T047~T070 중 Phase 8(Sheets 어댑터, U5)·Phase 9(Supabase 협업, U4)를
  착수하기 전, 무엇이 선행되어야 하고 어떤 외부 계정/시크릿이 필요한지 미리
  정리한다.
- **본 문서는 조사용 초안이며, 코드/설정 변경은 포함하지 않았다.**

## 1. T049~T065 의존 관계 표

| Task | 내용 | 선행 Task | 외부 준비물 필요 |
|---|---|---|---|
| T049 | Supabase 프로젝트에 `contracts/supabase-schema.sql` 적용(테이블, 뷰, 트리거, `upsert_snapshot`) | — (최초 착수 지점) | O — Supabase 프로젝트 + 콘솔/CLI 접근 |
| T050 | Supabase 프로젝트에 `contracts/rls-policies.sql` 적용(household RLS, `is_household_member`) | T049(같은 프로젝트에 순차 적용) | O — T049와 동일 프로젝트 |
| T051 | `apps-script/src/syncSnapshot.gs` 구현(시트 읽기 → 페이로드 변환 → `upsert_snapshot` RPC) | T049(RPC 함수가 존재해야 호출 대상이 생김) | O — 테스트용 스프레드시트 사본, Apps Script 프로젝트 |
| T052 | `apps-script/src/mappingHelpers.gs` 구현(`mapping_rule` 조회, `security_key` 결정) | T049(스키마의 `mapping_rule` 테이블 필요) | 없음(코드만, T051과 같은 Apps Script 프로젝트 내) |
| T053 | 시간 기반 트리거(매일 19:00 Asia/Seoul) + "지금 동기화" 커스텀 메뉴 등록 | T051 | 없음(코드/설정만, 실제 등록은 Apps Script 프로젝트 내에서 수행) |
| T054 | `syncSnapshot.gs` 실패 처리(try/catch + `upsert_sync_status` 항상 호출 + Stackdriver 로그) | T051 | 없음 |
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
- [ ] Google 계정 + 테스트용 스프레드시트 **사본** 1개 — 원본 시트를 직접 건드리지
      않도록 사본에 Apps Script 프로젝트를 연결(헌장 원칙 IX, 원본 불변)
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
| Supabase **service role key** | Apps Script → Supabase RPC(`upsert_snapshot`, `upsert_sync_status`) 인증, RLS 우회 | **Apps Script 프로젝트의 스크립트 속성(PropertiesService)** — `.env`/레포/프런트 코드에는 절대 두지 않음 | `contracts/apps-script-payload.md` §인증 참조 |
| (선택) CI용 테스트 Supabase URL/anon key/service role key | T058(RLS 통합 테스트)·T064(agenda-history 통합 테스트)를 CI에서 자동 실행하려는 경우 | **GitHub repository/organization Secrets**(예: `TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY`, `TEST_SUPABASE_SERVICE_ROLE_KEY`) | 이름은 예시이며 실제 도입 시 확정. `deploy.yml`과는 별도 워크플로(테스트 전용)로 분리 권장 — 배포 워크플로는 T083에 따라 `VITE_DATA_SOURCE=mock` 고정 유지 |

### 2.3 주의사항 (헌장 원칙 IV 관련)

- service role key는 어떤 경우에도 `.env`, 프런트 번들, 커밋된 파일에 두지
  않는다 — Apps Script 스크립트 속성에만 저장.
- `.env.local`은 이미 `.gitignore`에 포함되어 있는지 재확인 필요(T068에서 다시
  점검 예정).
- 이 문서에는 실제 URL/키 값을 기록하지 않았고, 앞으로도 기록하지 않는다 —
  이름/위치만 문서화 대상이다.

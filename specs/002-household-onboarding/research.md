# Phase 0 Research: 부부 가입·연결 온보딩 (상용화 기반)

기술 구조는 001을 그대로 잇는다(React SPA + Supabase, 별도 백엔드 서버 없음). 이 문서는 002에서
새로 정해야 하는 조합·방식을 기록한다. 아래 결정으로 plan의 NEEDS CLARIFICATION은 모두 해소된다.

## R1. 인증과 이메일 인증

**Decision**: Supabase Auth의 이메일·비밀번호 가입을 쓰고 "이메일 확인 필수"를 켠다. 실서비스에서는
Supabase 기본 메일 발송 대신 사용자 지정 SMTP를 연결한다.

**Rationale**: 001의 로그인(`AuthProvider.signIn`)을 그대로 확장할 수 있다. 기본 메일 발송은 개발용
제한이 있어 실제 가입 흐름(SC-001)을 막을 수 있다.

**Alternatives considered**: 매직 링크 로그인(비밀번호 없음) — 기존 로그인 화면과 테스트를 모두
바꿔야 해서 기각. 소셜 로그인 — spec Assumptions에서 범위 밖.

## R2. household 생성·초대·합류를 처리하는 위치

**Decision**: 생성·초대·취소·수락은 모두 DB 함수(RPC)로 처리한다(`create_household`,
`create_invitation`, `revoke_invitation`, `accept_invitation`). 합류처럼 아직 구성원이 아닌 사람이
household에 행을 넣어야 하는 동작은 `security definer`로 실행하고, 함수 안에서 `auth.uid()`와 조건을
직접 검사한다.

- 초대 토큰은 32바이트 난수다. DB에는 **SHA-256 해시만** 저장하고 원문은 생성 응답에서 한 번만 준다.
- 정원 2명(FR-004)은 수락 시 `household` 행을 잠그고(`for update`) 구성원 수를 다시 센다. 동시 수락
  중 하나만 성공한다(Edge Case).
- "한 사람은 한 household"(FR-003)는 기존 `household_members.user_id` 기본키가 이미 강제한다.
- 초대 링크는 `/invite#<token>` 형태로 토큰을 URL 조각(fragment)에 둔다. 조각은 HTTP 요청에 실리지
  않으며, 분석 page_view에도 경로 패턴만 보낸다(R8).

**Rationale**: 별도 서버 없이 원자적으로 처리할 수 있고, 권한 판단이 RLS와 같은 계층에 있다.
생성자에게만 주는 권한이 없으므로 원칙 I을 지킨다(두 구성원 모두 초대·취소 가능).

**Alternatives considered**: 클라이언트에서 테이블에 직접 insert — 비구성원의 insert를 허용하는 RLS가
필요해져 기각. Edge Function — 이 규모에서는 배포 단위만 늘어나 기각.

## R3. 동의 기록

**Decision**: 동의는 두 곳에 남긴다.
- `consent_record`: 추가만 하는 이력(사용자, 종류, 동의/철회, 문서 버전, 시각).
- 현재 상태: `user_profile`(약관 버전, 분석 동의)와 `household_members.shares_assets`(배우자 공개).

현재 상태를 바꾸는 RPC(`set_consent`)가 이력 행도 함께 쓴다.

**Rationale**: 화면과 RLS는 현재 상태만 빠르게 읽고, 법적 증빙은 이력으로 남긴다(FR-002).

**Alternatives considered**: 이력에서 매번 최신 행을 계산 — RLS 정책마다 하위 질의가 생겨 기각.

## R4. 배우자 공개 동의를 RLS로 강제

**Decision**: `account`·`holding` 조회 정책을 다음 조건으로 바꾼다.

> 내 소유이거나, (같은 household이고 소유자가 `shares_assets = true`)

집계 뷰는 이미 `security_invoker = true`이므로 공개하지 않은 구성원의 금액은 집계에서도 빠진다.
공동·자녀 계좌(`owner_user_id`가 null, 기존 household 전용)는 지금처럼 구성원 모두에게 보인다.

- 화면: 상대가 공개하지 않았으면 "상대방이 아직 공개하지 않음"을 표시하고, 부부 합계에는 "내 자산만
  포함" 안내를 붙인다.
- 기존 두 운영자: `shares_assets` 기본값은 false다. 다음 로그인 때 동의 화면이 뜨고, 동의 전까지는
  상대 금액이 보이지 않는다(spec Assumptions의 "새 동의 화면 1회 표시"와 같은 의미).

**Rationale**: 화면에서 숨기는 방식이 아니라 응답에서 빠지게 해야 원칙 II와 FR-012("필드 자체가
응답에 없어야")를 만족한다.

**Alternatives considered**: 기존 운영자는 동의한 것으로 간주(true로 이행) — 동의 기록 없이 공개를
유지하는 것이라 기각.

## R5. 표준 양식 형식과 업로드 처리

**Decision**:
- 양식은 **.xlsx 한 가지**로 낸다(`public/templates/quantmind-asset-template-v1.xlsx`). 작성 안내 시트를
  포함하고, 버전은 파일명과 안내 시트의 셀에 둔다. 항목 정의는 `contracts/asset-template-v1.md`.
- 브라우저에서 `read-excel-file`(MIT)로 읽고 zod로 전체를 검증한다. 실패하면 서버에 아무것도 보내지
  않고 행·열·이유를 보여준다.
- 통과한 행은 정규화된 JSON으로 `replace_my_assets` RPC에 보낸다. RPC는 같은 규칙으로 다시 검증하고,
  한 트랜잭션 안에서 내 개인 명의 계좌·종목을 지운 뒤 새로 넣는다(FR-011, "전부 아니면 전무").
- 종목코드가 있으면 `security_key`로 쓰고, 없으면 `is_mapped = false`("미매핑")로 넣는다.
- 1회 업로드 최대 500행으로 제한한다.
- 검증 실패 횟수는 내용 없이 `record_upload_rejection`으로만 남긴다(Guardrail G2 측정용).

**Rationale**: 한국어 Excel은 CSV를 CP949로 저장하는 경우가 많아 인코딩 오류가 잦다. xlsx는 이 문제가
없고, Google Sheets와 Numbers에서도 xlsx로 내보낼 수 있다. 클라이언트 검증으로 오류를 즉시 보여주고,
서버 재검증으로 우회 입력을 막는다.

**Alternatives considered**: CSV 지원 — 인코딩 분기와 안내 비용 때문에 v1에서 제외. 서버(Edge
Function)에서 파싱 — 파일 원본이 서버를 거치게 되고 배포 단위가 늘어나 기각. `xlsx`(SheetJS) npm
패키지 — npm 레지스트리 판이 오래되어 기각.

## R6. 기존 시트 동기화와의 공존

**Decision**: `household_members.asset_source`(`sheet_sync` | `template_upload`)를 둔다. 기존 두
운영자는 `sheet_sync`로 이행하고, 새 사용자는 `template_upload`로 시작한다. `replace_my_assets`는
`sheet_sync` 구성원에게 거부하며, 전환은 운영 측 SQL로만 한다(v1).

**Rationale**: 한 사람의 자산을 두 경로가 서로 덮어쓰는 일을 막는다. Apps Script 경로는 바꾸지 않는다
(spec Assumptions).

## R7. 내보내기 파일

**Decision**: 브라우저에서 `write-excel-file`(MIT, R5와 같은 제작자)로 만든다.
- 자산 내보내기: 표준 양식 v1과 같은 열 구조라서 그대로 다시 올릴 수 있다(SC-011).
- 판단 로그 내보내기: 시트 4개(안건, 의견, 합의, 변경 이력).

남는 구성원의 내보내기는 기존 RLS로 읽을 수 있는 범위를 그대로 쓴다. 떠나는 사람의 자산 금액은
`shares_assets`가 true일 때만 들어간다(FR-014c). 형식은 `contracts/export-files.md`.

**Rationale**: 서버가 파일을 만들거나 보관하지 않아도 된다. 읽기 권한이 곧 내보내기 범위가 되어 별도
권한 규칙이 필요 없다.

## R8. 분석 도구와 동의

**Decision**: GA4를 쓴다. 다만 **분석 동의가 있고, 내부 계정이 아니고, `VITE_DATA_SOURCE`가
`supabase`일 때만** gtag 스크립트를 동적으로 불러온다(FR-019). 그 밖에는 스크립트 자체를 불러오지
않는다.
- `send_page_view: false`로 자동 수집을 끄고, page_view는 경로 패턴으로만 보낸다(예: `/invite`).
- `user_id`는 설정하지 않는다.
- 동의를 철회하면 즉시 전송을 멈추고 `_ga` 쿠키를 지운다.
- 이벤트와 허용 속성은 `contracts/analytics-events.md`.

**Rationale**: 측정 계획 문서가 GA4를 전제로 했다. 스크립트를 불러오지 않는 방식이 "요청 0건"(SC-004)을
가장 확실하게 보장한다.

**Alternatives considered**: GA4 Consent Mode(스크립트를 불러온 채 저장만 막음) — 거부 상태에서도
신호 요청이 나갈 수 있어 FR-019와 맞지 않아 기각. 자체 이벤트 테이블 — household 집계(R9)와 역할이
겹치므로 웹 유입 흐름에는 GA4를 쓴다.

## R9. Activation·NSM 기록(서버 집계)

**Decision**:
- `household.created_at`, `household_members.joined_at`을 추가한다.
- 식별자 없는 `activation_record`를 둔다. `household.activation_record_id`가 이를 가리키며,
  household가 삭제되어도 기록은 남는다.
  - 필드: `household_created_at`, `partner_joined_at`, `first_valid_view_at`,
    `first_view_had_sync_failure`, `last_valid_view_at`, `last_fresh_valid_view_at`, `is_internal`
- 대시보드가 조건을 만족해 보이면 클라이언트는 `record_valid_summary_view()`를 부른다. 서버는
  Activation 조건 ①~⑤를 **다시 검사**하고, 통과할 때만 시각을 갱신한다.
- 두 구성원의 마지막 반영이 모두 30일 이내이면 `last_fresh_valid_view_at`도 갱신한다(NSM 품질 조건).
- 날짜별 기록 `activation_view_day`(household마다 KST 날짜당 1행)를 함께 남긴다(2026-10-13 추가). 첫·마지막
  시각만으로는 "28일 안에 다른 날 다시 봤는지"를 판단할 수 없기 때문이다.

**Rationale**: 분석 이벤트에는 household 식별자를 보낼 수 없다(FR-021). 그래서 household 단위 지표는
서비스 기록으로 센다(FR-022). 서버 재검사로 클라이언트 조작을 막는다. 삭제된 household도 분모에
남는다(`docs/ACTIVATION_DEFINITION.md` 결정 필요 항목 해소).

**`hasSyncFailure` 처리**: 성공으로 세되 `first_view_had_sync_failure`로 따로 표시한다(Activation 문서
제안대로).

## R10. 탈퇴·삭제 실행

**Decision**:
- `departure_request`(요청자, 요청 시각, 삭제 예정 시각 = 요청 + 7일, 상태, 계정 삭제 여부)를 둔다.
- 요청·취소는 RPC로 처리한다(`request_departure`, `cancel_departure`).
- 진행 중인 요청이 있으면 떠나는 사람의 안건·의견·업로드를 막는다. RLS 조건과 RPC 검사에
  `not is_departing(auth.uid())`를 넣는다.
- 실제 삭제는 `process_due_departures()`가 한다. Supabase의 `pg_cron`으로 1시간마다 실행한다.
  삭제 순서(FR-014):
  1. 떠나는 사람의 계좌·종목
  2. 떠나는 사람이 쓴 안건(의견·합의·이력은 cascade)
  3. 떠나는 사람이 쓴 의견
  4. 남는 사람 안건의 합의·이력에서 떠나는 사람 참조를 null로 바꾸기(화면에는 "떠난 구성원"으로 표시)
  5. 구성원 행 삭제. 마지막 구성원이면 household도 삭제(FR-015)
  6. 계정 삭제를 요청했다면 `auth.users` 행 삭제
- 4번을 위해 `agreement_record.confirmed_by_user_id`와 `agenda_history.changed_by_user_id`를
  nullable로 바꾼다. 원칙 VII 예외이며 plan의 Complexity Tracking에 기록한다.

**Rationale**: 별도 서버 없이 DB 안에서 예약 실행할 수 있다. 7일이 지나기 전에는 어떤 경로로도 삭제가
일어나지 않는다(SC-010).

**Alternatives considered**: 남는 사람이 로그인할 때 삭제 실행 — 아무도 로그인하지 않으면 삭제가
무기한 늦어져 기각. 즉시 삭제 — Clarification Q2(삭제 전 이전 필수)에 어긋나 기각.

## R11. 실서비스 배포

**Decision**:
- GitHub Pages 배포(`deploy.yml`)는 **그대로 mock 강제**로 둔다(AGENTS.md).
- 실서비스는 별도 정적 호스팅(Cloudflare Pages)에 `VITE_DATA_SOURCE=supabase`로 배포한다. 별도 워크플로
  또는 호스팅 쪽 빌드를 쓴다.
- Supabase 프로젝트는 v1에서 기존 프로젝트를 그대로 쓴다. 멀티테넌시는 RLS가 맡는다.

**Rationale**: 앱은 정적 SPA이고 비밀은 anon key뿐이라 어느 정적 호스팅이든 된다. 공개 데모와 실서비스를
분리해 mock 강제 규칙을 깨지 않는다.

**Alternatives considered**: Vercel·Netlify — 기능상 동등하다. 결정은 운영자 계정 보유 여부에 따라 바꿀
수 있다. 실서비스용 Supabase 프로젝트 분리 — 기존 household 이전 비용이 생겨 출시 직전 재검토 항목으로
남긴다.

## R12. 내부·테스트 제외

**Decision**: `user_profile.is_internal`(운영 측 SQL로만 설정)을 둔다. 내부 계정에는 분석 스크립트를
불러오지 않는다(R8). 내부 계정이 만든 household의 `activation_record.is_internal`은 true다. 집계에서는
`is_internal`, mock 모드, `[통합테스트]`·`[점검]` 데이터를 뺀다.

## R13. 초대 전달 경로

**Decision**: v1은 링크 복사만 지원한다(`partner_invite_send.channel = 'link'`). 서비스가 초대 메일을
보내지 않는다.

**Rationale**: 인증 메일 외의 메일 발송을 두지 않으면 SMTP 사용량과 스팸 위험이 줄어든다. 부부는
메신저로 링크를 주고받는 경우가 많다고 본다(가정).

## R14. 테스트 전략

**Decision**: 001과 같은 계층을 쓴다.
- 단위(Vitest): 양식 검증 스키마, 내보내기 → 다시 업로드 왕복(SC-011), 분석 게이트(동의·내부·모드
  조합별로 스크립트를 불러오는지)
- 통합(`npm run test:integration`): RPC와 RLS. 공개 동의, 정원, 탈퇴 차단·삭제, anon 거부
- e2e(Playwright, mock 모드, 데스크톱·모바일): 가입 → 생성 → 초대 → 합류 → 업로드 → 탈퇴 요청

새 훅은 mock과 supabase 두 모드를 모두 지원한다(AGENTS.md). MSW 핸들러를 추가한다.

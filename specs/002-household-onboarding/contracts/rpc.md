# RPC 계약: 002 household onboarding

모든 함수는 `authenticated`에만 execute 권한을 준다(anon 회수, 001 원칙 유지). 아래 표의 "실행 권한"은
`security definer`(정의자 권한) 또는 `security invoker`(호출자 권한·RLS 적용)다. 오류는 SQLSTATE
코드로 구분하고, 클라이언트가 기술 용어 없는 문구로 바꾼다(001 `toUserMessage` 방식).

## 공통 오류 코드

| 코드 | 의미 | 사용자 문구 예 |
|---|---|---|
| `42501` | 권한 없음(구성원 아님, 탈퇴 진행 중 등) | 이 작업을 할 수 없는 상태입니다. |
| `P0010` | 약관 미동의 | 서비스 약관에 먼저 동의해 주세요. |
| `P0011` | 이미 다른 household에 속함 | 이미 다른 가구에 속해 있어 합류할 수 없습니다. |
| `P0012` | 정원 초과 | 이 가구는 이미 두 명입니다. |
| `P0013` | 초대가 유효하지 않음(없음·사용됨·만료·취소) | 쓸 수 없는 초대입니다. 새 초대를 요청해 주세요. |
| `P0014` | 업로드 검증 실패(서버 재검증) | 파일 내용을 확인해 주세요. (행·열 정보 포함) |
| `P0015` | 시트 동기화 사용자의 업로드 | 이 계정은 시트 동기화를 사용 중입니다. |
| `P0016` | 이미 진행 중인 탈퇴 요청 | 이미 탈퇴 절차가 진행 중입니다. |

## 가입·household

| 함수 | 입력 | 반환 | 실행 권한 | 규칙 |
|---|---|---|---|---|
| `set_consent(p_kind text, p_granted boolean, p_document_version text default null)` | 동의 종류·여부·문서 버전 | void | definer | `consent_record`에 행을 추가하고 현재 상태(`user_profile` 또는 `household_members.shares_assets`)를 갱신한다. `share_assets`는 구성원일 때만 가능 |
| `create_household(p_name text)` | 이름 1~40자 | `household.id` | definer | 약관 미동의면 P0010, 이미 소속이면 P0011. household, 구성원 행, `activation_record`를 함께 만든다 |

## 초대

| 함수 | 입력 | 반환 | 실행 권한 | 규칙 |
|---|---|---|---|---|
| `create_invitation()` | — | `{ invitation_id, token, expires_at }` | definer | 호출자가 구성원이어야 함. 구성원 2명이면 P0012. 기존 `pending`은 `revoked`로 바꾸고 새로 만든다. `token`은 이 응답에서만 원문으로 준다 |
| `revoke_invitation(p_invitation_id uuid)` | 초대 id | void | definer | 같은 household 구성원이면 누구나 가능(원칙 I) |
| `get_invitation_status(p_token text)` | 토큰 원문 | `{ status, expires_at }` | definer | 로그인한 사용자만 호출. household 이름·구성원·금액 정보는 반환하지 않음(원칙 III) |
| `accept_invitation(p_token text)` | 토큰 원문 | `household.id` | definer | 약관 P0010, 기존 소속 P0011, household 잠금 후 정원 P0012, 토큰 P0013. 성공하면 구성원 행 추가, 초대 `accepted`, `activation_record.partner_joined_at` 기록 |

## 자산 업로드

| 함수 | 입력 | 반환 | 실행 권한 | 규칙 |
|---|---|---|---|---|
| `replace_my_assets(p_template_version text, p_rows jsonb)` | 정규화된 행 배열(최대 500) | `{ upload_id, row_count, applied_at }` | definer | 호출자 = 구성원이고 탈퇴 진행 중이 아님. `asset_source = 'sheet_sync'`면 P0015. 행 규칙은 `asset-template-v1.md`로 다시 검증해 실패하면 P0014(아무것도 바꾸지 않음). 통과하면 한 트랜잭션에서 내 `member` 계좌·종목을 지우고 새로 넣고, `account.last_synced_at = now()`, `asset_upload(applied)` 기록 |
| `record_upload_rejection(p_template_version text, p_error_count int)` | 버전, 오류 수 | void | definer | 내용은 받지 않는다. `asset_upload(rejected)` 기록 |

## 측정

| 함수 | 입력 | 반환 | 실행 권한 | 규칙 |
|---|---|---|---|---|
| `record_valid_summary_view(p_had_sync_failure boolean)` | 화면에 실패 배지가 있었는지 | `{ counted: boolean }` | definer | `data-model.md` §3 조건을 서버에서 다시 검사한다. 통과하면 `first_valid_view_at`(비어 있을 때만), `last_valid_view_at`, 조건부로 `last_fresh_valid_view_at`을 갱신. 그날(KST) 첫 유효 조회면 `activation_view_day`에 한 행 추가(`had_fresh_data` 포함) |

## 탈퇴·삭제

| 함수 | 입력 | 반환 | 실행 권한 | 규칙 |
|---|---|---|---|---|
| `request_departure(p_delete_account boolean)` | 계정 삭제 여부 | `{ request_id, scheduled_at }` | definer | 진행 중 요청이 있으면 P0016. `scheduled_at = now() + 7일` |
| `cancel_departure()` | — | void | definer | 본인의 `pending` 요청만 `cancelled`로 바꿈 |
| `get_departure_status()` | — | `{ mine?, partner? }` | invoker | 내 요청과 상대의 `pending` 요청(삭제 예정 시각)만 반환(FR-014d) |
| `process_due_departures()` | — | int(처리 건수) | definer, **pg_cron 전용** | `authenticated`에 권한 없음. `scheduled_at <= now()`인 `pending`을 research R10 순서로 처리 |

## RLS 변경 요약

| 대상 | 변경 |
|---|---|
| `account`, `holding` select | 내 소유이거나 (같은 household이고 소유자 `shares_assets`) — 공동·자녀 계좌는 기존 유지 |
| `agenda`, `opinion` insert | 기존 조건과 `not is_departing(auth.uid())` |
| `user_profile` | 본인 행 select만 허용. update는 RPC로만 |
| `consent_record` | 본인 행 select만 허용 |
| `invitation` | 같은 household 구성원 select. `token_hash` 컬럼은 select 권한에서 제외 |
| `asset_upload` | 본인 행 select |
| `departure_request` | 직접 select 없음(`get_departure_status`로만) |
| `activation_record`, `activation_view_day` | 클라이언트 권한 없음 |

# Error Contract: QUANT-MIND 공동 자산 관리 대시보드

이 문서는 spec.md(Edge Cases, FR-002/FR-004/FR-013/FR-015/FR-016/FR-016a/FR-017/
FR-019/FR-021/FR-024)와 Clarifications 세션(2026-09-05) 결과에 명시된 오류
상황만을 다룬다. 이 문서에 없는 오류 상황(예: rate limiting, 파일 업로드 오류
등)은 spec.md에 근거가 없으므로 포함하지 않았다.

스택은 Supabase(PostgREST + RLS)이며 별도 백엔드 서버가 없으므로(plan.md
Technical Context), 아래 표의 "HTTP 상태"는 대부분 **PostgREST/Postgres가 실제로
반환하는 상태 코드**를 기준으로 하되, RLS의 특성상 "권한 없음"과 "존재하지 않음"이
서버 레벨에서 구분되지 않는 경우가 있다. 이 경우 프런트엔드가 별도의 오류 코드로
구분해 사용자에게 안내해야 하며, 이는 아래 각 항목에 명시했다.

## 오류 계약 표

| HTTP 상태 | 오류 코드 | 조건 |
|---|---|---|
| 401 | `AUTH_REQUIRED` | 로그인하지 않은 사용자가 보호된 화면(대시보드/계좌·종목 리스트/판단 로그) 또는 그에 대응하는 Supabase 쿼리에 접근(FR-002) |
| 200 (빈 결과) → 앱 레벨 `NOT_FOUND_OR_FORBIDDEN` | `HOUSEHOLD_SCOPE_DENIED` | 로그인은 되어 있으나 자신이 속하지 않은 household의 리소스(계좌/종목/안건/의견)에 접근 시도 — RLS가 행 자체를 반환하지 않아 서버는 200 + 빈 결과로 응답(§ 아래 "다른 household 접근" 절 참고) |
| 200 (0 rows updated) → 앱 레벨 `CONFLICT` | `AGENDA_ALREADY_AGREED` | 이미 "합의완료(agreed)" 상태인 안건의 제목/내용을 직접 UPDATE로 수정 시도(FR-021, agenda_update RLS 정책이 `status='discussing'`만 허용) |
| 200 (0 rows updated) → 앱 레벨 `FORBIDDEN` | `AGENDA_EDIT_NOT_AUTHOR` | 작성자 본인이 아닌 운영자가 "논의중" 안건의 제목/내용을 수정 시도(FR-016a, agenda_update RLS 정책이 `author_user_id = auth.uid()`만 허용) |
| 400 | `VALIDATION_TITLE_LENGTH` | 안건 제목이 공백 제거 후 1~100자 범위를 벗어남(FR-016) — 클라이언트 zod 검증(`agendaTitleSchema`)에서 우선 차단, 우회 시 DB CHECK 제약(`char_length(btrim(title)) between 1 and 100`) 위반으로 400 |
| 400 | `VALIDATION_BODY_LENGTH` | 안건 내용이 공백 제거 후 1~2000자 범위를 벗어남(FR-016) — 위와 동일한 이중 방어 구조(`agendaBodySchema`, DB CHECK) |
| 400 | `VALIDATION_OPINION_LENGTH` | 의견이 공백 제거 후 1~2000자 범위를 벗어남(FR-017) — `opinionBodySchema`, DB CHECK 이중 방어 |
| 200 | (오류 아님) `HOLDING_UNMAPPED` | 종목 표기가 매핑 정의로 자동 매칭되지 않아 `is_mapped=false`로 조회됨(FR-015) — **정상적인 데이터 상태**이며 오류가 아님. 목록에서 제외하지 않고 그대로 반환 |
| 500 / 4xx (Apps Script → Supabase RPC 실패) | `SYNC_UPSERT_FAILED` | Apps Script의 `syncSnapshot`이 시트 읽기 오류 또는 `upsert_snapshot`/`upsert_sync_status` RPC 호출 자체의 실패로 스냅샷을 반영하지 못함(contracts/apps-script-payload.md) — Apps Script 쪽에서 발생하는 오류이며, 대시보드로는 `account.last_sync_status='failed'`라는 **정상 200 응답의 데이터 값**으로 전달됨(FR-024) |
| 200 | (오류 아님) `ACCOUNT_SYNC_FAILURE_FLAG` | 하나 이상의 계좌가 `last_sync_status='failed'`인 상태로 대시보드/개인·부부 통합 뷰 조회 — 요청 자체는 성공(200)하며, `has_sync_failure=true` 값으로 대시보드에 실패 배지를 표시(FR-024) |
| 0 (네트워크 단절) 또는 5xx | `NETWORK_OR_SERVER_ERROR` | 네트워크 단절, 타임아웃, Supabase 서버 오류 등으로 조회/저장 자체가 실패 |

## 사용자 안내 문구 및 화면 상태 매핑

아래 "구현 상태" 열은 현재 구현된 `ErrorState`/`EmptyState`/`PermissionDeniedState`
컴포넌트(`src/components/ui/`) 중 어떤 것을 사용하는지, 또는 아직 대응 컴포넌트가
없어 신규가 필요한지를 나타낸다.

| 오류 코드 | 안내 문구 | 구현 상태 |
|---|---|---|
| `AUTH_REQUIRED` | "로그인이 필요한 화면입니다." | 구현됨 — `PermissionDeniedState` (현재 기본 메시지와 동일) |
| `HOUSEHOLD_SCOPE_DENIED` | [결정 필요] "해당 데이터를 찾을 수 없습니다." (존재 여부 자체를 알리지 않는 문구) 로 할지, 아니면 "접근 권한이 없습니다."로 할지 | 미구현 — 현재 세 컴포넌트 중 정확히 맞는 것이 없음. `EmptyState`를 재사용할지, 별도 `NotFoundState`를 새로 만들지 [결정 필요] |
| `AGENDA_ALREADY_AGREED` | "이미 합의가 확정된 안건은 직접 수정할 수 없습니다. 새 의견으로 남겨주세요." | 미구현 — 판단 로그(User Story 3) 구현 시 추가 필요, 성격상 `ErrorState`보다는 안내형 메시지(경고 톤)가 적합해 보이나 [결정 필요] |
| `AGENDA_EDIT_NOT_AUTHOR` | "작성자만 이 안건의 제목/내용을 수정할 수 있습니다." | 미구현 — User Story 3 구현 시 추가 필요 |
| `VALIDATION_TITLE_LENGTH` | "제목은 공백을 제외하고 1자 이상 100자 이하로 입력해주세요." | 미구현(zod 스키마는 존재하나 폼 UI에 오류 메시지를 표시하는 컴포넌트는 User Story 3 구현 시 추가) — `src/lib/validation/agenda.ts`의 메시지 문구를 그대로 사용 |
| `VALIDATION_BODY_LENGTH` | "내용은 공백을 제외하고 1자 이상 2000자 이하로 입력해주세요." | 미구현(위와 동일) |
| `VALIDATION_OPINION_LENGTH` | "의견은 공백을 제외하고 1자 이상 2000자 이하로 입력해주세요." | 미구현(위와 동일) |
| `HOLDING_UNMAPPED` | "미매핑 — 원본 표기: {rawLabel}. 매핑을 등록해주세요." | 부분 구현 — `mockHoldings`에 `isMapped`/`rawLabel` 필드는 있으나, 이를 화면에 "미매핑" 배지로 렌더링하는 것은 User Story 2(`HoldingDetailPanel`, T033) 구현 시 예정. 오류 컴포넌트가 아니라 `StatusBadge`(tone="warning") 사용이 적합 |
| `SYNC_UPSERT_FAILED` | (운영자에게 직접 노출되는 문구 아님 — Apps Script 실행 로그/Stackdriver 대상) | 해당 없음 — 이 오류는 Apps Script 레이어의 오류이며, 대시보드 사용자에게는 `ACCOUNT_SYNC_FAILURE_FLAG`로만 간접 노출됨 |
| `ACCOUNT_SYNC_FAILURE_FLAG` | "일부 계좌 동기화 실패" | 구현됨 — `SyncStatusBanner`의 `StatusBadge`(tone="negative") |
| `NETWORK_OR_SERVER_ERROR` | "데이터를 불러오지 못했습니다." (조회 시) / [결정 필요] 저장 실패 시 별도 문구("저장하지 못했습니다. 다시 시도해주세요.") 필요 여부 | 조회 실패는 구현됨 — `ErrorState`(기본 메시지 그대로 사용, 재시도 버튼 포함). 저장 실패용 별도 문구/컴포넌트는 미구현 |

## 세부 판단 사항

### 1. 다른 household 데이터 접근 시도 — 403 대신 404를 쓸지

**결론(권장)**: 403이 아니라 사실상 **"없음"에 준하는 응답**을 사용한다.

**근거**: 이 프로젝트는 Supabase RLS로 접근 제어를 구현한다(plan.md, contracts/
rls-policies.sql). RLS가 적용된 SELECT는 "권한이 없어서 안 보임"과 "애초에 그런
행이 없음"을 서버 레벨에서 구분하지 않는다 — 둘 다 그냥 **0 rows, HTTP 200**으로
돌아온다. 즉 PostgREST는 403을 반환하지 않는다(별도로 구현하지 않는 한). 이는
헌장 원칙 II·III(금액 데이터는 인증 경계에서 통제하며, 프런트 로직으로 숨기지
않는다)와도 부합한다 — 애초에 서버가 존재 여부조차 알려주지 않으므로, 공격자가
다른 household의 리소스 ID를 추측해 존재 여부를 확인(enumeration)할 수 없다.

**[결정 필요]**: 프런트엔드가 이 "빈 결과"를 사용자에게 어떻게 보여줄지는 아직
정해지지 않았다 — (a) `EmptyState`("아직 등록된 항목이 없습니다")를 그대로
재사용할지, (b) "해당 데이터를 찾을 수 없습니다" 같은 별도 문구의 컴포넌트를
새로 만들지는 spec.md에 명시적 근거가 없어 확정하지 못했다. 다만 어느 쪽이든
"권한이 없다"는 사실 자체를 알리는 문구(예: "접근 권한이 없습니다")는 피하는
것이 위 근거와 일관되므로, 이 방향으로 결정할 때 참고할 것.

### 2. 합의완료 안건 수정 시도 / 작성자 아닌 수정 시도 — 왜 "0 rows updated"인가

data-model.md와 contracts/rls-policies.sql의 `agenda_update` 정책은
`status = 'discussing' AND author_user_id = auth.uid()`인 행만 UPDATE 대상으로
허용한다. 조건에 맞지 않으면 PostgREST는 오류를 던지지 않고 **매칭되는 행이 0개인
성공 응답**을 반환한다. 따라서 이 두 경우를 사용자에게 구분해서 안내하려면,
프런트엔드가 응답의 업데이트된 행 수(또는 반환된 배열 길이)를 직접 확인해 앱
레벨에서 `AGENDA_ALREADY_AGREED` 또는 `AGENDA_EDIT_NOT_AUTHOR`로 분기해야 한다.
어느 경우인지는 UI가 이미 알고 있는 정보(현재 안건의 `status`, 로그인한
`author_user_id`와 안건의 `authorUserId` 비교)로 UPDATE 요청 전에 미리 판별해,
애초에 수정 버튼 자체를 비활성화하는 방식(방어적 UI)과 병행하는 것이 자연스럽다
— 다만 이는 구현 방식 제안이며 spec.md에 명시된 요구사항은 아니므로 [결정 필요]로
남긴다.

### 3. 미매핑 종목과 진짜 시스템 오류의 구분

- **미매핑(정상 상태)**: `holding.is_mapped = false`인 상태로 정상 200 응답에
  포함되어 조회됨. FR-015에 따라 목록에서 제외되지 않고 "미매핑" 표시와 함께
  노출된다. 이는 오류가 아니다.
- **진짜 시스템 오류**: 예를 들어 `mapping_rule` INSERT(수동 매핑 등록, FR-015)
  자체가 실패하는 경우(중복 키 위반, 네트워크 오류 등)는 위 표의
  `VALIDATION_*` 또는 `NETWORK_OR_SERVER_ERROR`에 해당하며, "미매핑 상태 표시"와는
  다른 별도의 오류 흐름이다.

### 4. Sheets 동기화 실패의 두 레이어

- **Apps Script ↔ Supabase 레이어**: `syncSnapshot`이 `upsert_snapshot`/
  `upsert_sync_status` RPC 호출 자체에 실패하는 경우. 이는 운영자가 대시보드에서
  직접 보는 오류가 아니라 Apps Script 실행 로그(Stackdriver)에 남는
  오류이며(contracts/apps-script-payload.md), 이 문서의 표에는 참고용으로만
  포함했다.
- **대시보드 ↔ 사용자 레이어**: 위 실패가 있었는지 여부는 `account.last_sync_status`
  컬럼 값으로 대시보드 조회 응답(200)에 정상적으로 포함되어 전달되고,
  `SyncStatusBanner`가 "일부 계좌 동기화 실패" 배지로 보여준다(FR-024, 이미 구현됨).
  즉 사용자 관점에서는 이것이 "오류 화면"이 아니라 "정상적으로 표시되는 경고
  상태"라는 점이 중요하다.

## 이 문서에 포함하지 않은 것

- spec.md MVP 제외 항목(공개 화면 구현, AI 분석, 종목 차트 등)에 관련된 오류 —
  구현 범위 밖이므로 오류 계약도 정의하지 않음.
- rate limiting, 파일 업로드, 세션 만료 재로그인 흐름 등 spec.md/Clarifications에
  명시되지 않은 오류 상황 — 임의로 추가하지 않음.

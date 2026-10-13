# Data Model: 부부 가입·연결 온보딩

001 스키마(`supabase/migrations/20260927121300_schema.sql` 이후)에 더하거나 바꾸는 것만 적는다. 결정
근거는 `research.md`의 R 번호로 표시한다.

## 1. 기존 테이블 변경

### household
| 필드 | 변경 | 규칙 |
|---|---|---|
| `created_at` | 추가 `timestamptz not null default now()` | 기존 행은 이행 시각으로 채움. Activation t0 (R9) |
| `activation_record_id` | 추가 `uuid null → activation_record(id) on delete set null` | 생성 시 함께 만든 기록을 가리킴 |

### household_members
| 필드 | 변경 | 규칙 |
|---|---|---|
| `joined_at` | 추가 `timestamptz not null default now()` | 합류(또는 생성) 시각 |
| `shares_assets` | 추가 `boolean not null default false` | 배우자 공개 동의 현재 상태(R3, R4). 기존 운영자도 false로 시작 |
| `asset_source` | 추가 `text not null default 'template_upload'`, `sheet_sync` 또는 `template_upload` | 기존 두 운영자는 `sheet_sync`로 이행(R6) |

- 정원: household당 최대 2행. 수락 RPC에서 잠금 후 검사한다(R2).
- 역할·관리자 컬럼은 두지 않는다(원칙 I).

### agreement_record / agenda_history
| 필드 | 변경 | 규칙 |
|---|---|---|
| `agreement_record.confirmed_by_user_id` | not null → **nullable** | null이면 화면에 "떠난 구성원"으로 표시. 탈퇴 처리에서만 null로 바뀜(R10) |
| `agenda_history.changed_by_user_id` | not null → **nullable** | 같음 |

`confirmed_at`, `changed_at` 시각은 그대로 유지한다(원칙 VII 예외의 범위).

### account / holding (RLS만 변경)
- 조회 조건: 내 소유이거나, 같은 household이면서 소유자가 `shares_assets = true`(R4).
- `owner_user_id`가 null인 공동·자녀 계좌는 지금처럼 같은 household 구성원에게 보인다.
- 업로드 경로(`replace_my_assets`)는 `owner_type = 'member'`이고 `owner_user_id = auth.uid()`인 계좌만
  지우고 새로 만든다.

## 2. 새 테이블

### user_profile
| 필드 | 타입 | 규칙 |
|---|---|---|
| `user_id` | uuid PK → auth.users on delete cascade | 가입 시 트리거로 생성 |
| `terms_version` | text null | 동의한 약관 버전. null이면 동의 화면으로 이동(FR-002) |
| `terms_agreed_at` | timestamptz null | |
| `analytics_opt_in` | boolean not null default false | opt-in(FR-018) |
| `is_internal` | boolean not null default false | 운영 측 SQL로만 변경(R12). 클라이언트 업데이트 권한 없음 |

### consent_record (추가만 함)
| 필드 | 타입 | 규칙 |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid → auth.users on delete cascade | |
| `kind` | text | `terms`, `share_assets`, `analytics` |
| `granted` | boolean | true = 동의, false = 철회 |
| `document_version` | text null | `terms`일 때 필수 |
| `created_at` | timestamptz default now() | |

- update·delete 권한 없음. `set_consent` RPC만 insert한다.
- 계정이 삭제되면 함께 지운다. 출시 전 법률 검토에서 보존 의무가 확인되면 이 규칙을 바꾼다.

### invitation
| 필드 | 타입 | 규칙 |
|---|---|---|
| `id` | uuid PK | |
| `household_id` | uuid → household on delete cascade | |
| `created_by_user_id` | uuid → household_members(user_id) on delete cascade | |
| `token_hash` | text unique not null | SHA-256(토큰). 원문은 저장하지 않음(R2) |
| `created_at` | timestamptz default now() | |
| `expires_at` | timestamptz not null | `created_at + 7일`(FR-006) |
| `status` | text | `pending` → `accepted` / `revoked` / `expired` |
| `accepted_by_user_id` | uuid null | |
| `resolved_at` | timestamptz null | |

**상태 전이**
- `pending` → `accepted`: 수락 RPC 성공. 정원과 기존 소속을 다시 검사한다.
- `pending` → `revoked`: 구성원이 취소.
- `pending` → `expired`: 만료 시각이 지난 뒤 수락을 시도하거나 정리 작업이 실행될 때.
- `accepted`·`revoked`·`expired`는 최종 상태다.
- household에 `pending` 초대는 최대 1개다. 구성원이 2명이면 새 초대를 만들 수 없다(FR-004, FR-006).

### asset_upload
| 필드 | 타입 | 규칙 |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid → household_members(user_id) on delete cascade | |
| `template_version` | text not null | 예: `v1` |
| `result` | text | `applied` 또는 `rejected` |
| `row_count` | int null | `applied`일 때 반영 행 수 |
| `error_count` | int null | `rejected`일 때 오류 수. 내용은 저장하지 않음 |
| `created_at` | timestamptz default now() | `applied`이면 그 시각이 기준 시점이 됨 |

- 구성원별 보유 내역 마지막 반영 시각은 `max(created_at) where result = 'applied'`로 구한다. 시트 동기화
  구성원은 기존처럼 `account.last_synced_at`을 쓴다. NSM의 I2 지표에 쓴다.

### departure_request
| 필드 | 타입 | 규칙 |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid → household_members(user_id) | 떠나는 사람 |
| `household_id` | uuid → household | |
| `requested_at` | timestamptz default now() | |
| `scheduled_at` | timestamptz not null | `requested_at + 7일`(FR-014a) |
| `delete_account` | boolean default false | 계정 삭제 요청 여부(FR-017) |
| `status` | text | `pending` → `cancelled` / `completed` |
| `resolved_at` | timestamptz null | |

**상태 전이**
- `pending` → `cancelled`: 떠나는 사람이 기간 중에 취소. 아무것도 지우지 않는다.
- `pending` → `completed`: `scheduled_at`이 지난 뒤 `process_due_departures()`가 R10 순서로 삭제.
- 한 사용자에게 `pending`은 최대 1개다.
- `pending` 동안 떠나는 사람의 agenda·opinion insert와 업로드를 막는다(`is_departing()`).

`completed` 행은 남는 사람이 볼 수 없게 하고, 운영 감사용으로만 남긴다. 떠난 사람의 `user_id`는
`completed`가 되는 시점에 null로 바꿔 식별자를 남기지 않는다.

### activation_record (식별자 없음)
| 필드 | 타입 | 규칙 |
|---|---|---|
| `id` | uuid PK | household id와 무관한 난수 |
| `household_created_at` | timestamptz not null | t0 |
| `partner_joined_at` | timestamptz null | 두 번째 구성원 합류 시각 |
| `first_valid_view_at` | timestamptz null | Activation 성공 시각. 한 번 정해지면 바꾸지 않음 |
| `first_view_had_sync_failure` | boolean null | `hasSyncFailure` 표시(R9) |
| `last_valid_view_at` | timestamptz null | 마지막 유효 조회 |
| `last_fresh_valid_view_at` | timestamptz null | 두 구성원 반영이 모두 30일 이내였던 마지막 유효 조회(NSM 품질 조건) |
| `is_internal` | boolean not null default false | 내부 계정이 만든 household |

- 클라이언트에는 select·update 권한을 주지 않는다. `create_household`, `accept_invitation`,
  `record_valid_summary_view`(모두 security definer)만 쓴다.
- household가 삭제되어도 남는다(분모 보존, `docs/ACTIVATION_DEFINITION.md`).

### activation_view_day (식별자 없음, 2026-10-13 추가)
| 필드 | 타입 | 규칙 |
|---|---|---|
| `activation_record_id` | uuid → activation_record(id) on delete cascade | |
| `view_date_kst` | date | 유효 조회가 있었던 KST 날짜 |
| `had_fresh_data` | boolean not null | 그날 첫 유효 조회 시점에 두 구성원 반영이 모두 30일 이내였는지 |

- 기본키는 (`activation_record_id`, `view_date_kst`)다. household마다 날짜당 1행만 남는다.
- `record_valid_summary_view`가 그날 첫 유효 조회일 때만 insert한다(`on conflict do nothing`). 클라이언트
  권한은 없다.
- 용도: 4주 가치 재사용률. 첫 성공일 다음 날부터 28일 안에 다른 날의 행이 있는지 본다. 같은 날 다시 본
  것은 세지 않는다(`docs/RETENTION_REVIEW_PRACTICE.md`).

## 3. 유효한 부부 합계 판단(서버)

`record_valid_summary_view()`가 아래 조건을 모두 검사한다. 근거는 `docs/ACTIVATION_DEFINITION.md` §2.

1. 호출자 household의 구성원이 2명
2. 두 구성원 모두 반영된 자산이 있음(`personal_aggregate_view`에 행이 있고 기준 시점이 null 아님)
3. household 기준 시점이 null 아님
4. 두 구성원 모두 `shares_assets = true`
5. 두 구성원 모두 `departure_request`가 `pending`이 아님

조건 ④("조회가 오류 없이 끝남")는 클라이언트가 성공 응답을 받은 뒤에만 호출한다.

## 4. 화면 도메인 타입 변경(`src/types/domain.ts`)

- `PersonalAggregate`: `isShared: boolean` 추가. 상대가 공개하지 않았으면 금액 필드 대신 비공개 상태로
  표시한다. 비공개 상대의 금액은 응답에 없으므로 클라이언트가 0으로 채우지 않는다.
- `AgreementRecord.confirmedByDisplayName`, `AgendaHistoryEntry.changedByDisplayName`: null이면
  "떠난 구성원"으로 표시한다.
- 새 타입: `Invitation`, `ConsentState`, `AssetUploadResult`, `DepartureRequest`.

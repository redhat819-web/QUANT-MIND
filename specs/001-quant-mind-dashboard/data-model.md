# Phase 1 Data Model: QUANT-MIND 공동 자산 관리 대시보드

모든 테이블은 Supabase PostgreSQL에 위치한다. 금액 관련 컬럼을 포함하는 테이블/뷰는
전부 RLS가 적용되며, household 소속 사용자만 접근 가능하다(§ RLS 섹션은
`contracts/rls-policies.sql` 참조).

## 1. 핵심 엔티티

### household

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | household 식별자 (이 프로젝트에서는 사실상 1행) |
| name | text | 표시용 이름(예: "우리집") |

### household_members

| 컬럼 | 타입 | 설명 |
|---|---|---|
| user_id | uuid PK, FK → auth.users | Supabase Auth 사용자 |
| household_id | uuid FK → household | 소속 household |
| display_name | text | 대시보드에 "나 / 상대방" 대신 표시할 이름(선택) |

- role/is_admin 컬럼 없음(헌장 원칙 I). 두 행이 존재하면 그 자체로 "동등한 두
  운영자"가 성립한다.

### account (계좌)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| household_id | uuid FK | RLS 스코프 |
| owner_user_id | uuid FK → household_members.user_id | 계좌 소유자(필수 항목 "소유자") |
| account_name | text NOT NULL | 계좌명 |
| source_sheet_id | text | 원본 스프레드시트 식별자(추적용) |
| updated_at | timestamptz | 계좌 레코드 자체의 마지막 갱신 시각(메타데이터) |
| last_synced_at | timestamptz | Apps Script가 이 계좌의 스냅샷을 마지막으로 **성공** 반영한 시각(자동 저녁 7시 또는 수동 동기화 공통) |
| last_sync_status | text CHECK IN ('success','failed') | 가장 최근 동기화 시도 결과 |
| last_sync_error | text NULL 허용 | 실패 시 원인 메시지(성공 시 NULL) |

- `last_synced_at`은 **성공한** 동기화만 갱신한다. 실패 시 `last_sync_status='failed'`와
  `last_sync_error`만 갱신되고, `last_synced_at`은 마지막 성공 시점 그대로 유지되어
  대시보드가 "가장 최근에 확실히 반영된 시점"을 정확히 표시할 수 있게 한다.

### holding (종목/보유자산)

| 컬럼 | 타입 | Nullable | 설명 |
|---|---|---|---|
| id | uuid PK | | |
| account_id | uuid FK → account | NOT NULL | |
| security_key | text FK → mapping_rule.security_key | NOT NULL | 표준화된 종목 식별자 |
| display_name | text | NOT NULL | 종목명(필수) |
| quantity | numeric | NOT NULL | 수량(필수) |
| market_value_krw | numeric | NOT NULL | 평가금액(원화, 필수) |
| return_rate | numeric | NOT NULL | 손익률(필수) |
| classification | text CHECK IN ('growth','defensive','cash') | NOT NULL | 분류(필수, 수동 변경 가능) |
| classification_updated_by | uuid FK | NULL 허용 | 마지막 수동 변경자 |
| ticker | text | **NULL 허용** | 조건부: 종목코드 |
| currency | text | **NULL 허용** | 조건부: 통화(원화 외 보유 시에만 값 존재) |
| average_cost | numeric | **NULL 허용** | 조건부: 평균 매입가 |
| dividend | numeric | **NULL 허용** | 조건부: 배당 |
| is_mapped | boolean NOT NULL DEFAULT false | | 매핑 정의로 표준 종목에 연결됐는지 여부 |
| raw_label | text | NOT NULL | 원본 스프레드시트 표기(미매핑 시 화면에 노출) |

- 조건부 4개 컬럼(ticker/currency/average_cost/dividend)은 항상 nullable이며, 값이
  없어도 계산/렌더링 로직이 오류 없이 동작해야 한다(헌장 원칙 X, FR-013).
- `is_mapped = false`인 행은 목록에서 제외되지 않고 "미매핑" 배지와 함께 노출된다
  (FR-015, Clarifications 세션 Q4).

### mapping_rule (매핑 정의)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| owner_user_id | uuid FK | 어느 운영자의 원본 표기에 대한 규칙인지 |
| raw_label | text NOT NULL | 원본 스프레드시트에 적힌 종목 표기 |
| security_key | text NOT NULL | 표준 종목 식별자(두 사람이 같은 종목이면 동일 값) |
| created_at | timestamptz | |
| UNIQUE(owner_user_id, raw_label) | | 동일 표기는 규칙 1개만 |

- 원본 스프레드시트의 열 구성 자체는 변경하지 않으며(헌장 원칙 IX), 이 테이블이
  "표기 → 표준 식별자" 변환만 담당한다.

### personal_aggregate_view (뷰, 개인 통합)

계산 전용 뷰. 저장 테이블이 아님.

```sql
-- 개념적 정의 (실제 SQL은 contracts/supabase-schema.sql 참조)
SELECT
  a.owner_user_id,
  a.household_id,
  SUM(h.market_value_krw)                                   AS total_market_value_krw,
  SUM(h.market_value_krw * h.return_rate) / NULLIF(SUM(h.market_value_krw), 0)
                                                              AS weighted_return_rate,
  MIN(a.last_synced_at)                                      AS as_of_synced_at
FROM account a
JOIN holding h ON h.account_id = a.id
GROUP BY a.owner_user_id, a.household_id;
```

- "가중 평균"은 평가금액을 가중치로 사용(FR-005a).
- `as_of_synced_at`은 이 운영자의 계좌들 중 **가장 오래된** `last_synced_at`을
  택한다 — 계좌 중 하나라도 동기화가 뒤처져 있으면 그 시점을 "기준 시점"으로
  보수적으로 표시하기 위함(FR-024).
- `has_sync_failure`(bool)는 이 운영자의 계좌 중 하나라도
  `last_sync_status='failed'`이면 true — 대시보드의 "일부 계좌 동기화 실패"
  배지 표시에 사용.

### household_aggregate_view (뷰, 부부 통합)

```sql
SELECT
  household_id,
  SUM(total_market_value_krw)                                AS total_market_value_krw,
  SUM(total_market_value_krw * weighted_return_rate)
    / NULLIF(SUM(total_market_value_krw), 0)                 AS weighted_return_rate,
  MIN(as_of_synced_at)                                       AS as_of_synced_at
FROM personal_aggregate_view
GROUP BY household_id;
```

- 개인 통합 뷰를 다시 가중 평균하여 부부 통합을 도출(계좌 → 개인 통합 → 부부
  통합 3단계 구조를 SQL 레이어에서 그대로 반영).
- `as_of_synced_at`도 두 운영자의 개인 통합 기준 시점 중 더 오래된 쪽을 그대로
  이어받아, 대시보드 최상단에 표시할 단일 "기준 시점"(FR-024)을 제공한다.

### allocation_view (뷰, 성장/방어/현금 비중)

household_id, classification별 SUM(market_value_krw)과 household 전체 대비 비율을
계산하는 뷰. 개인 단위 비중이 필요해지면 owner_user_id를 추가한 동일 구조의 뷰를
둘 수 있으나, 이번 spec 범위(FR-006)는 household 단위 비중만 요구하므로 1개로
한정한다.

### public_allocation_view (뷰, 공개 화면 대비 — 구현은 범위 외)

`classification`, `weight_percentage`만 SELECT하며 `market_value_krw`,
`return_rate` 등 금액·손익 관련 컬럼은 애초에 포함하지 않는다(헌장 원칙 III, §10
참조). 이번 기능에서는 뷰 정의만 만들고, 이를 노출하는 화면/엔드포인트 사용은
구현하지 않는다.

## 2. 판단 로그 엔티티

### agenda (안건)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| household_id | uuid FK | |
| author_user_id | uuid FK NOT NULL | 작성자(FR-022) |
| title | text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 100) | 제목 |
| body | text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000) | 내용 |
| status | text NOT NULL CHECK IN ('discussing','agreed') DEFAULT 'discussing' | 논의중/합의완료 |
| created_at | timestamptz NOT NULL DEFAULT now() | |
| updated_at | timestamptz NOT NULL DEFAULT now() | "논의중" 상태에서 작성자가 수정 시 갱신 |

- CHECK 제약은 공백 제거(`btrim`) 후 길이를 검증해 FR-016을 DB 레벨에서도 강제한다
  (프런트 zod 검증과 이중 방어).
- UPDATE는 애플리케이션 레벨에서 "작성자 본인 + status='discussing'"일 때만 허용
  (RLS의 UPDATE 정책 조건, FR-016a).

### opinion (의견)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| agenda_id | uuid FK → agenda | |
| author_user_id | uuid FK NOT NULL | |
| body | text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000) | |
| created_at | timestamptz NOT NULL DEFAULT now() | |

- INSERT-only(수정/삭제 없음) — 의견은 그 자체로 시점의 기록이므로 이력 관리
  대상이 아니다(안건/합의 기록만 변경 이력 대상, 헌장 원칙 VIII).

### agreement_record (합의 기록)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| agenda_id | uuid FK → agenda UNIQUE | 안건당 1개(최신 확정 상태) |
| confirmed_by_user_id | uuid FK NOT NULL | 확정 수행자 |
| confirmed_at | timestamptz NOT NULL DEFAULT now() | 확정 시각 |
| opinion_count_at_confirmation | int NOT NULL DEFAULT 0 | 확정 시점 의견 수(0 허용, FR-019) |

- INSERT 시 트리거가 `agenda.status`를 `'agreed'`로 전환.

### agenda_history (변경 이력, append-only)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| agenda_id | uuid FK → agenda | |
| changed_by_user_id | uuid FK NOT NULL | 수정자 |
| changed_at | timestamptz NOT NULL DEFAULT now() | 수정 시각 |
| reason | text NOT NULL | 수정 사유 |
| previous_title | text | 수정 전 제목(NULL이면 내용만 변경) |
| previous_body | text | 수정 전 내용 |

- "합의완료" 상태의 안건에 대한 UPDATE 요청은, 트리거가 실제 컬럼을 덮어쓰기
  전에 현재 값을 이 테이블에 먼저 append한다(FR-021, 헌장 원칙 VIII). 이 테이블은
  UPDATE/DELETE 정책을 두지 않아 애플리케이션에서도 수정 불가능하다.

## 3. 상태 값 정리 (FR-023 대응)

| 화면 상태 | 적용 위치 | 표현 방식 |
|---|---|---|
| 로딩 | 모든 데이터 조회 훅 | `LoadingState` 컴포넌트(스피너 + 텍스트) |
| 빈 목록 | 계좌·종목/판단 로그 목록 | `EmptyState`(아이콘 + "아직 등록된 항목이 없습니다" 텍스트) |
| 오류 | 네트워크/서버 오류 | `ErrorState`(재시도 버튼 + 오류 텍스트) |
| 권한 없음 | 비로그인 접근, RLS 거부 응답 | 로그인 안내 화면으로 리다이렉트, 데이터 미포함 |
| 저장 중 | 안건/의견 작성, 분류 변경, 합의 확정 | 버튼 비활성화 + "저장 중" 텍스트 |
| 데이터 없음 | 조건부 항목(ticker/currency/average_cost/dividend)이 null | 해당 셀에 "데이터 없음" 텍스트(색상만으로 표현하지 않음, 원칙 XIII) |
| 동기화 실패 안내 | 대시보드 상단 "기준 시점" 영역, `last_sync_status='failed'`인 계좌가 있을 때 | "기준 시점: YYYY-MM-DD HH:mm 기준" 옆에 "일부 계좌 동기화 실패" 텍스트 배지(색상+텍스트 병기)를 추가 표시. 상세 원인(`last_sync_error`)은 계좌·종목 리스트의 해당 계좌 항목에서 확인 가능 |

## 4. 엔티티 관계 요약

```
household 1───N household_members
household 1───N account (owner_user_id → household_members)
account   1───N holding (security_key → mapping_rule.security_key)
household_members 1───N mapping_rule (owner_user_id)
household 1───N agenda
agenda    1───N opinion
agenda    1───1 agreement_record (있으면 status='agreed')
agenda    1───N agenda_history (append-only)

personal_aggregate_view  = GROUP BY account.owner_user_id (holding 집계)
household_aggregate_view = GROUP BY household_id (personal_aggregate_view 재집계)
allocation_view          = GROUP BY household_id, classification
public_allocation_view   = allocation_view에서 금액 컬럼 제외한 서브셋(구현 범위 외)
```

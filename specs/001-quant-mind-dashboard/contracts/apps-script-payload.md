# Apps Script → Supabase 스냅샷 페이로드 계약

## 실행 방식

- **트리거**: `syncSnapshot` 함수는 시간 기반 트리거로 **매일 저녁 7시(한국 시간,
  Asia/Seoul) 1회** 실행한다(`ScriptApp.newTrigger('syncSnapshot').timeBased()
  .everyDays(1).atHour(19).inTimezone('Asia/Seoul').create()`). 국내 정규장 마감
  이후 확정된 종가를 기준으로 스냅샷을 뜨기 위한 시간대다. 기존에 검토했던 1일 4회
  주기는 사용 패턴에 비해 과도하다고 판단해 폐기했다.
- 스프레드시트 커스텀 메뉴의 "지금 동기화" 수동 실행 항목은 그대로 유지한다 —
  운영자가 저녁 7시를 기다리지 않고 즉시 최신화하고 싶을 때 사용한다. 자동/수동
  실행 모두 동일한 `syncSnapshot` 함수를 호출하며, 아래 동기화 상태 필드도
  동일하게 갱신된다.
- **인증**: Apps Script는 Supabase **service role key**를 `PropertiesService`의
  스크립트 속성에 저장해 사용한다(헌장 원칙 IV — 코드에 직접 기록 금지). 이 키는
  RLS를 우회하므로 Apps Script 프로젝트 외부로 노출되지 않도록 관리한다.
- **원본 불변 원칙**: Apps Script는 시트의 셀 값을 **읽기만** 하며, 수식/열 구성/
  시트 구조를 변경하는 코드는 포함하지 않는다(헌장 원칙 IX).

## 동기화 상태 기록 (성공/실패 가시성)

`syncSnapshot`은 시도할 때마다 결과를 `account.last_synced_at` /
`last_sync_status` / `last_sync_error`(`data-model.md` 참조)에 반영한다:

- **성공**: `last_synced_at = now()`, `last_sync_status = 'success'`,
  `last_sync_error = null`.
- **실패**(시트 읽기 오류, GOOGLEFINANCE 값 오류, 네트워크/Supabase 오류 등):
  `last_sync_status = 'failed'`, `last_sync_error`에 원인 메시지(예: `"시트
  '계좌1' D12 셀 값이 숫자가 아님"`, `"Supabase 응답 500"`) 기록. **이 경우
  `last_synced_at`은 갱신하지 않고 마지막 성공 시점을 그대로 유지**한다.
- Apps Script 코드는 `syncSnapshot` 본문을 try/catch로 감싸, 실패 시에도 위 상태
  갱신 RPC(`upsert_sync_status`)만은 반드시 호출해 실패 자체가 조용히 묻히지
  않도록 한다. 또한 Google Apps Script의 실행 로그(Stackdriver)에도 동일 오류를
  남겨 개발자가 별도로 원인을 추적할 수 있게 한다.
- 프런트엔드는 대시보드 최상단에 household 기준 가장 오래된 `as_of_synced_at`을
  "기준 시점: YYYY-MM-DD HH:mm 기준"으로 표시하고(FR-024), 하나 이상의 계좌가
  `last_sync_status='failed'`이면 그 옆에 "일부 계좌 동기화 실패" 텍스트 배지를
  함께 표시한다(색상만으로 표현하지 않음, 헌장 원칙 XIII).

## 페이로드 스키마 (계좌·종목 스냅샷)

```json
{
  "owner_user_id": "uuid",
  "source_sheet_id": "string",
  "synced_at": "ISO 8601 timestamp",
  "accounts": [
    {
      "account_name": "string",
      "holdings": [
        {
          "raw_label": "string (원본 시트 표기 그대로)",
          "quantity": "number",
          "market_value_krw": "number",
          "return_rate": "number",
          "ticker": "string | null",
          "currency": "string | null",
          "average_cost": "number | null",
          "dividend": "number | null"
        }
      ]
    }
  ]
}
```

- `classification`(분류)은 이 페이로드에 포함하지 않는다 — 최초 생성 시 기본값은
  서버 측 upsert 로직이 부여하고, 이후 값은 운영자가 앱에서 수동 변경한 값을
  덮어쓰지 않는다(FR-011, upsert는 `ON CONFLICT ... DO UPDATE`에서 classification
  컬럼을 제외한 컬럼만 갱신).
- `security_key`도 페이로드에 없다 — 수신 측(Supabase 함수 또는 PostgREST 이후
  실행되는 후처리)이 `mapping_rule(owner_user_id, raw_label)`을 조회해 채우며,
  일치하는 규칙이 없으면 `is_mapped = false`로 upsert한다(FR-015).

## 전송 방식

- PostgREST의 `POST /rest/v1/rpc/upsert_snapshot`(Postgres 함수)를 호출해, 위
  페이로드 전체를 한 번의 요청으로 원자적으로 반영한다(REST 개별 테이블 upsert
  다건 호출 대신 함수 호출 1회로 트랜잭션 보장). 이 함수는 내부에서 성공 시
  `last_synced_at`/`last_sync_status='success'`까지 함께 갱신한다.
- 시트 읽기 단계 또는 HTTP 호출 자체가 실패해 `upsert_snapshot`을 호출하지
  못한 경우, Apps Script는 별도의 경량 RPC `POST /rest/v1/rpc/upsert_sync_status`
  (파라미터: `owner_user_id`, `status='failed'`, `error_message`)를 호출해 실패
  사실만이라도 반드시 기록한다.
- 실패 시 Apps Script는 실행 로그(Stackdriver)에도 오류를 남기고, 다음 트리거
  주기(다음날 저녁 7시)에 재시도한다(운영자가 "지금 동기화"로 즉시 재시도하는
  것도 가능).

## 필수/조건부 항목과의 매핑

| spec.md 항목 | 페이로드 필드 | 비고 |
|---|---|---|
| 소유자 | `owner_user_id`(페이로드 상단) | 계좌·종목 전체에 공통 적용 |
| 계좌 | `accounts[].account_name` | |
| 종목명 | 매핑 후 `holding.display_name`(원본은 `raw_label`) | |
| 수량 | `holdings[].quantity` | |
| 평가금액(원화) | `holdings[].market_value_krw` | Google Sheets에서 이미 원화 환산 완료 후 전달 |
| 손익률 | `holdings[].return_rate` | |
| 분류 | (페이로드에 없음, 서버 측 관리) | |
| 종목코드/통화/평균 매입가/배당 | 조건부 필드, null 허용 | 시트에 값이 없으면 `null` 그대로 전달 |

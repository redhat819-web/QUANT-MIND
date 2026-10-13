# 자산 표준 양식 v1

- 파일: `public/templates/quantmind-asset-template-v1.xlsx`
- 시트: `자산`(입력), `작성 안내`(설명과 예시, 버전 셀 `B1 = v1`)
- 1행은 머리글이다. 머리글 이름이 아래 표와 정확히 같아야 한다(순서는 자유).
- 최대 500행. 빈 행은 무시한다.
- 업로드 대상은 업로드한 사람 **본인 명의** 계좌뿐이다. 공동·자녀 계좌는 v1에서 받지 않는다.

## 열 정의

| 머리글 | 필수 | 형식 | 규칙 | 내부 필드 |
|---|---|---|---|---|
| 계좌명 | 필수 | 텍스트 1~40자 | 같은 이름이 같은 계좌로 묶임 | `account.account_name` |
| 종목명 | 필수 | 텍스트 1~100자 | | `holding.display_name`, `raw_label` |
| 수량 | 필수 | 숫자 ≥ 0 | 소수 허용(최대 8자리) | `holding.quantity` |
| 평가금액(원) | 필수 | 숫자 ≥ 0 | 원화. 해외 종목은 원화로 환산한 값 | `holding.market_value_krw` |
| 매입금액(원) | 선택 | 숫자 > 0 | 원화 합계. 비면 이 종목은 수익률 계산에서 빠짐(001 `cost_krw` 규칙) | `holding.cost_krw` |
| 분류 | 선택 | `성장` / `방어` / `현금` | 비면 미분류 | `holding.classification` |
| 종목코드 | 선택 | 텍스트 1~20자 | 비면 "미매핑" | `holding.ticker`, `security_key` |
| 통화 | 선택 | 3자리 통화 코드(예: `USD`) | 표시용 | `holding.currency` |
| 평균단가 | 선택 | 숫자 > 0 | 표시용, 계산에 쓰지 않음 | `holding.average_cost` |
| 배당 | 선택 | 숫자 ≥ 0 | 표시용 | `holding.dividend` |

## 검증 오류 표시

오류는 `{ row, column, message }` 목록으로 보여준다. `row`는 엑셀의 행 번호다. 예:

| 상황 | message |
|---|---|
| 필수 머리글 없음 | "'평가금액(원)' 열이 없습니다. 최신 양식을 내려받아 주세요." |
| 숫자가 아님 | "숫자로 적어 주세요." |
| 분류 값이 다름 | "성장, 방어, 현금 중 하나로 적거나 비워 두세요." |
| 500행 초과 | "한 번에 500행까지 올릴 수 있습니다." |
| 다른 버전 | 읽을 수 있으면 받음. 아니면 "최신 양식을 내려받아 주세요." |

## 서버에 보내는 정규화 행(`replace_my_assets.p_rows`)

```json
[{ "account_name": "연금저축", "display_name": "KODEX 200", "quantity": 10,
   "market_value_krw": 350000, "cost_krw": 320000, "classification": "growth",
   "ticker": "069500", "currency": "KRW", "average_cost": 32000, "dividend": null }]
```

분류는 `성장 → growth`, `방어 → defensive`, `현금 → cash`, 빈 값 → `unclassified`로 바꾼다.

## 버전 규칙

- 열을 추가하는 변경은 새 버전(`v2`)으로 내고, 이전 버전 파일은 계속 받는다(헌장 IX 개정안).
- 열의 뜻을 바꾸거나 없애는 변경은 하지 않는다. 필요하면 새 열을 만든다.

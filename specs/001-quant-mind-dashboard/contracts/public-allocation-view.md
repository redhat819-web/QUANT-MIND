# 공개 화면 대비 데이터 계약 (구현 범위 외, 스키마만 선반영)

spec.md 기준 공개 화면 구현은 이번 기능 범위에서 제외되지만(MVP 제외 목록),
헌장 원칙 III(공개 화면 데이터의 금액 배제)을 나중에 위반 없이 만족하려면 지금
스키마 단계에서 "금액을 아예 담지 않는 뷰"를 함께 설계해 둔다.

## `public_allocation_view`

| 컬럼 | 타입 | 포함 여부 |
|---|---|---|
| household_id | uuid | 포함 |
| classification | text ('growth'/'defensive'/'cash') | 포함 |
| weight_ratio | numeric (0~1) | 포함 |
| classification_market_value_krw | numeric | **제외** — 원본 `allocation_view`에는 있으나 이 뷰의 SELECT 목록에서 의도적으로 뺀다 |
| total_market_value_krw 등 모든 금액 컬럼 | — | **제외** |

- `weight_ratio`는 금액의 비율이지만, 분모(household 전체 평가금액)를 알 수 없으면
  역산으로 원본 금액을 복원할 수 없으므로 노출 가능(헌장 원칙 III의 "역산 가능하면
  노출로 간주" 기준을 충족하려면, 향후 이 뷰를 anon 역할에 공개할 때 반드시
  `total_market_value_krw`나 절대 금액이 포함된 다른 응답과 **함께** 노출하지
  않아야 한다 — 두 값을 조합하면 절대 금액이 역산되기 때문).
- 이번 기능에서는 이 뷰에 대한 RLS `anon` 정책을 활성화하지 않는다. 향후 공개
  화면을 구현하는 별도 기능에서 `for select using (true)` 형태의 익명 접근 정책을
  추가하되, 그 시점에도 이 뷰 구조(금액 컬럼 없음)를 유지해야 한다.

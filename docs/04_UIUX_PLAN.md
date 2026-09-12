# UI·UX Plan: QUANT-MIND 공동 자산 관리 대시보드

**대상 문서**: `specs/001-quant-mind-dashboard/spec.md`,
`specs/001-quant-mind-dashboard/data-model.md`

**디자인 기준**: `DESIGN.md`(Kraken 원본, 수정 금지) → `DESIGN.quantmind.md`(오버레이,
DESIGN.md보다 우선) → `src/styles/tokens.css`(실제 토큰 구현)

**성격**: 두 명의 공동 관리자만 로그인해 함께 보는 비공개 가계 자산 대시보드.
마케팅 사이트가 아니므로 Hero, CTA Banner, 제품 소개 Section, 사진, 일러스트를
두지 않는다.

이 문서는 화면 설계만 다룬다. 색·폰트·간격·반경 값은 전부 기존 토큰
(`src/styles/tokens.css`)을 그대로 참조하며, 이 문서에서 새로운 값을 제안하지
않는다. 실제 구현 코드와 Task 목록은 이 문서의 범위가 아니다.

---

## 0. 화면 목록 (정확히 4개로 고정)

| 화면 ID | 경로 | 이름 | Mobile 변형 |
|---|---|---|---|
| SCR-001 | `/dashboard` | 가계 대시보드 | 정의함 (390px) |
| SCR-002 | `/holdings` | 계좌·종목 | 정의함 (390px) |
| SCR-003 | `/judgment-log` | 판단 로그 | 반응형 규칙만 적용 |
| SCR-004 | `/login` | 로그인 | 반응형 규칙만 적용 |

Desktop 기준 너비 1440px, Mobile 기준 너비 390px. 이 문서에 정의되지 않은
5번째 화면은 만들지 않는다.

---

## 1. 공통 규칙 (4개 화면 전체 적용)

### 1.1 색·타이포·간격·반경

`src/styles/tokens.css`에 정의된 변수만 사용한다.

- 배경 `--color-bg`, 표면 `--color-surface`, 본문 `--color-text`,
  보조 텍스트 `--color-text-muted`, 경계선 `--color-border`
- 등락: 상승 `--color-rise`/`--color-rise-text`(빨강),
  하락 `--color-fall`/`--color-fall-text`(파랑).
  `--color-success`(초록)는 동기화 성공 등 시스템 성공 상태 전용이며 등락에는
  **절대 쓰지 않는다.**
- 브랜드 보라 `--color-accent`/`--color-accent-dark`는 조작 요소(주요 버튼,
  링크, 선택 상태)에만 쓰고 등락 표시에는 쓰지 않는다.
- 간격은 `--space-1`(8px) ~ `--space-6`(64px)만 쓴다.
- 버튼 반경 `--radius`(12px), 카드/보조 요소 반경 `--radius-sm`(8px). pill
  버튼 금지.
- 그림자는 `--shadow-subtle`, `--shadow-micro` 두 종류만.

### 1.2 수치 표기

- 모든 수치는 `.num` 클래스 기준(`font-variant-numeric: tabular-nums`,
  우측 정렬)을 따른다. 라벨은 좌측 정렬.
- 금액은 정수 + 천 단위 구분, 통화 단위 표기 생략 금지(`12,480,000 원`,
  `8,240.50 USD`).
- 비율은 소수 둘째 자리 고정, 부호(`+`/`−`) 항상 표기. 0은 `0.00%`로 표시하고
  빈칸으로 두지 않는다.
- 등락색은 변화량·변화율 숫자에만 적용(`.num--rise`, `.num--fall`). 평가금액
  자체는 `--color-text`.

### 1.3 기준 시점 / 안내 문구

- 분석 결과가 표시되는 모든 화면(대시보드, 계좌·종목, 판단 로그) 최상단에
  "기준 시점: YYYY-MM-DD HH:mm 기준"을 노출한다(FR-024, data-model.md
  `household_aggregate_view.as_of_synced_at` / `personal_aggregate_view.as_of_synced_at`
  기준).
- 같은 화면들 하단에 "참고용 — 투자 권유 아님"을 노출한다(FR-008).
- 로그인 화면(SCR-004)은 분석 결과가 없으므로 두 문구 모두 대상 아님.

### 1.4 상태 처리 (data-model.md §3 그대로 적용)

| 상태 | 표현 | 적용 화면 |
|---|---|---|
| Loading | 스피너(`.state-spinner`) + 텍스트 | 전체 데이터 조회 영역 |
| Empty | "아직 등록된 항목이 없습니다" 텍스트(`.state`) | SCR-002 목록, SCR-003 목록 |
| Error | 오류 텍스트 + 재시도 버튼(`.state-error`) | 전체 데이터 조회/저장 영역 |
| Unauthorized | 로그인 안내 화면(SCR-004)으로 이동, 데이터 미포함 | SCR-001, SCR-002, SCR-003 진입 시 |
| Saving | 버튼 비활성화 + "저장 중" 텍스트 | 분류 변경, 안건 작성, 의견 작성, 합의 확정 |
| 데이터 없음 | 해당 셀에 "데이터 없음" 텍스트(색상만으로 표현 금지) | SCR-002 조건부 항목(ticker/currency/average_cost/dividend) |
| 동기화 실패 안내 | 기준 시점 옆 "일부 계좌 동기화 실패" 텍스트 배지 | SCR-001 상단 바 |

조건부 항목이 null이면 "데이터 없음" 텍스트로 표시하고 색상만으로 구분하지
않는다. `is_mapped = false` 종목은 목록에서 제외하지 않고 "미매핑" 배지와
함께 노출한다(FR-015).

### 1.5 접근성 / 반응형

- 모든 상호작용 요소는 키보드 포커스 가능해야 하며 `tokens.css`의 focus
  outline(`outline: 2px solid var(--color-accent)`)을 그대로 따른다.
- 터치 영역은 44px 이상 확보한다(버튼, 토글, 배지 클릭 영역 포함).
- 컬럼이 많은 표는 페이지 자체가 아니라 표만 가로 스크롤한다
  (`.table-scroll`, 헌장 원칙 XV).
- SCR-003, SCR-004는 별도 Mobile 목업 없이 위 반응형 규칙(표 스크롤, 폭
  가변, 44px 터치 영역)만으로 390px에서도 핵심 시나리오가 깨지지 않게 한다.

---

## 2. SCR-001 `/dashboard` — 가계 대시보드

### 2.1 사용자 목표

로그인한 운영자가 별도 화면 이동 없이 (1) 나의 개인 통합, (2) 상대방의 개인
통합, (3) 부부 통합의 총 평가금액·수익률을 확인하고, 성장/방어/현금 비중과
논의 중인 안건을 함께 파악한다(User Story 1, SC-001).

### 2.2 영역 구성과 순서 (Desktop 1440px)

1. **기준 시점 바** — "기준 시점: YYYY-MM-DD HH:mm 기준" + (동기화 실패 시)
   "일부 계좌 동기화 실패" 배지. 카드 밖, 페이지 최상단 고정.
2. **3단 집계 블록** — 나 / 상대방 / 부부 합계. **카드 안에 넣지 않고 배경
   위에 직접 놓는다.** 나와 상대방은 동등한 크기·순서로 나란히 배치하고,
   부부 합계는 시각적으로 가장 크게 강조한다(1열: 나 | 상대방, 2열 또는
   확장 영역: 부부 합계).
3. **성장·방어·현금 비중** — 가로 누적 막대 1개 + 범례(`AllocationLegend`).
   도넛 대신 가로 누적 막대를 우선한다(DESIGN.quantmind.md 3.7). 계열 색은
   중립 계열을 쓰고 등락 빨강/파랑을 재사용하지 않는다.
4. **논의 중인 안건 목록** — 3~5행(`AgendaSummaryList`). 그 이상은 "판단
   로그에서 모두 보기" 링크로 SCR-003 이동.
5. **"참고용 — 투자 권유 아님"** — 화면 최하단 고정 문구.

### 2.3 영역별 데이터 항목 (data-model.md 컬럼명 기준)

| 영역 | 데이터 항목 | 출처 |
|---|---|---|
| 기준 시점 바 | `household_aggregate_view.as_of_synced_at`, `personal_aggregate_view.has_sync_failure` | 뷰 |
| 3단 집계 — 나 | `personal_aggregate_view.total_market_value_krw`, `weighted_return_rate` (본인 `owner_user_id`) | 뷰 |
| 3단 집계 — 상대방 | 동일 뷰, 상대방 `owner_user_id` | 뷰 |
| 3단 집계 — 부부 합계 | `household_aggregate_view.total_market_value_krw`, `weighted_return_rate` | 뷰 |
| 비중 막대 | `allocation_view.classification`, `weight_percentage`(household 단위) | 뷰 |
| 안건 목록 | `agenda.title`, `agenda.status`(`discussing`만 노출) | 테이블 |

### 2.4 상태

| 상태 | 처리 |
|---|---|
| Loading | 3단 집계·비중·안건 목록 각 영역에 스켈레톤/스피너, 기준 시점 바는 이전 값 유지 |
| Empty | 계좌·종목이 전혀 없으면 집계 블록에 "0 원 / 0.00%" 표시(원칙 §1.2), 안건이 없으면 "논의 중인 안건이 없습니다" |
| Error | 집계 조회 실패 시 해당 블록에 `ErrorState` + 재시도, 기준 시점 바는 마지막 성공 값 유지(화면 전체를 비우지 않음) |
| Unauthorized | 비로그인 접근 시 SCR-004로 이동, 금액 데이터 전혀 전달하지 않음(FR-002) |
| Saving | 해당 없음(대시보드는 조회 전용) |

### 2.5 이동 목적지

- 안건 목록 항목 클릭 → SCR-003 해당 안건 상세
- "판단 로그에서 모두 보기" → SCR-003 목록
- (선택) 집계 블록의 "계좌·종목 보기" → SCR-002

### 2.6 Mobile 390px 변형

- 3단 집계 블록은 나 → 상대방 → 부부 합계 세로 1열로 쌓는다. 부부 합계는
  가장 아래에 두되 카드 배경 대비를 키워 강조를 유지한다.
- 비중 막대는 전체 폭 사용, 범례는 막대 아래로 줄바꿈.
- 안건 목록은 3행만 우선 노출, 나머지는 "더 보기" 링크로 SCR-003 이동.
- 기준 시점 바와 하단 안내 문구는 Desktop과 동일하게 상시 노출.

---

## 3. SCR-002 `/holdings` — 계좌·종목

### 3.1 사용자 목표

운영자가 계좌별 요약과 종목별 상세를 빠른 확인/상세 모드로 조회하고, 종목
분류를 수동으로 변경한다(User Story 2, SC-002).

### 3.2 영역 구성과 순서 (Desktop 1440px)

1. **기준 시점 바** — SCR-001과 동일 규칙.
2. **모드 토글** — 빠른 확인 / 상세 (`QuickModeToggle`). 보라 선택 상태로
   현재 모드 표시.
3. **계좌 요약표** — 빠른 확인 모드의 기본 표시(`AccountSummaryTable`).
4. **종목 표** — 상세 모드 선택 또는 계좌 클릭 시 노출(`HoldingDetailPanel`
   목록형).
5. **우측 상세 패널** — 특정 종목 선택 시 우측에 상세 카드 표시(2단 레이아웃:
   좌측 표 + 우측 상세).
6. **"참고용 — 투자 권유 아님"** — 화면 최하단.

### 3.3 영역별 데이터 항목

| 영역 | 데이터 항목 | 출처 |
|---|---|---|
| 계좌 요약표 | `account.account_name`, `account.owner_user_id`(소유자 표시명), 계좌 합계 평가금액·대표 손익률(계좌 내 holding 집계), `account.last_synced_at` | `account` + `holding` 집계 |
| 종목 표 | `holding.display_name`, `holding.quantity`, `holding.market_value_krw`, `holding.return_rate`, `holding.classification`, `holding.is_mapped`(미매핑 배지), `holding.raw_label`(미매핑 시) | `holding` |
| 우측 상세 | `holding.ticker`, `holding.currency`, `holding.average_cost`, `holding.dividend`(조건부, null이면 "데이터 없음"), 분류 변경 컨트롤(`ClassificationSelect`) | `holding` |

FR-012 필수 항목(소유자, 계좌, 종목명, 수량, 평가금액(원화), 손익률, 분류)은
빠른 확인/상세 모드 어느 쪽에서도 누락 없이 표시한다.

### 3.4 상태

| 상태 | 처리 |
|---|---|
| Loading | 계좌 요약표·종목 표 각각 스피너 |
| Empty | 계좌/종목이 없으면 "아직 등록된 항목이 없습니다"(표 대신 EmptyState) |
| Error | 조회 실패 시 `ErrorState` + 재시도 |
| Unauthorized | 비로그인 접근 시 SCR-004로 이동 |
| Saving | 분류 변경 저장 중 `ClassificationSelect` 비활성화 + "저장 중" 텍스트, 완료 시 즉시 반영(대시보드 비중 계산에도 반영, FR-011) |
| 데이터 없음 | ticker/currency/average_cost/dividend가 null이면 해당 셀 "데이터 없음" 텍스트 |
| 미매핑 | `is_mapped=false` 종목은 제외하지 않고 목록에 유지하며 "미매핑" 테두리 배지 표시(원본 표기 `raw_label` 병기) |

### 3.5 이동 목적지

- 계좌 요약표 행 클릭 → 해당 계좌의 종목 표로 스크롤/필터
- 종목 표 행 클릭 → 우측 상세 패널에 해당 종목 표시
- 상단 "대시보드로" 링크 → SCR-001

### 3.6 Mobile 390px 변형

- 우측 상세 패널은 별도 컬럼이 아니라 종목 선택 시 하단에 펼쳐지는 패널로
  전환(2단 → 1단).
- 계좌 요약표·종목 표는 `.table-scroll`로 가로 스크롤, 페이지 자체는
  스크롤되지 않는다.
- 모드 토글은 상단에 고정, 44px 이상 터치 영역 확보.

---

## 4. SCR-003 `/judgment-log` — 판단 로그

### 4.1 사용자 목표

운영자가 투자 안건을 작성하고, 상대 운영자가 의견을 남기며, 두 운영자 중
누구든 합의를 확정하고, 확정된 합의를 이후 재조회한다(User Story 3, SC-004,
SC-005).

### 4.2 영역 구성과 순서 (Desktop 1440px, 반응형 규칙만 적용 — 별도 Mobile 목업 없음)

1. **기준 시점 바**는 이 화면에는 없음(안건은 자산 데이터와 독립적이므로
   FR-024 대상 아님). 대신 상단에 "안건 작성" 버튼(주요 CTA, 보라)을 둔다.
2. **안건 목록** — 상태(논의중/합의완료) 필터, 각 행에 제목·상태 배지·작성자·
   작성 시각(`AgendaList`).
3. **안건 상세** — 목록 항목 선택 시 우측 또는 하단에 표시: 제목, 내용,
   작성자·작성 시각, 상태.
4. **의견 이력** — 안건 상세 하위 영역(`OpinionThread`), 작성자·작성 시각과
   함께 시간순 표시.
5. **의견 작성 폼** — "논의중" 상태에서만 노출(`AgendaForm` 하위).
6. **합의 확정 버튼** — "논의중" 상태에서 노출(`AgreementConfirmButton`),
   의견 0건이어도 활성화(FR-019).
7. **변경 이력** — "합의완료" 안건을 재수정한 경우에만 노출: 이전 값·수정자·
   수정 시각·사유(`agenda_history`).
8. **"참고용 — 투자 권유 아님"** — 이 화면도 판단 근거를 다루는 분석 화면이므로
   최하단에 동일 문구 노출.

### 4.3 영역별 데이터 항목

| 영역 | 데이터 항목 | 출처 |
|---|---|---|
| 안건 목록 | `agenda.title`, `agenda.status`, `agenda.author_user_id`, `agenda.created_at` | `agenda` |
| 안건 상세 | `agenda.title`, `agenda.body`, `agenda.author_user_id`, `agenda.created_at`, `agenda.updated_at`, `agenda.status` | `agenda` |
| 의견 이력 | `opinion.body`, `opinion.author_user_id`, `opinion.created_at` | `opinion` |
| 합의 정보 | `agreement_record.confirmed_by_user_id`, `agreement_record.confirmed_at`, `agreement_record.opinion_count_at_confirmation` | `agreement_record` |
| 변경 이력 | `agenda_history.previous_title`, `previous_body`, `changed_by_user_id`, `changed_at`, `reason` | `agenda_history` |

### 4.4 상태

| 상태 | 처리 |
|---|---|
| Loading | 안건 목록·상세 각각 스피너 |
| Empty | 안건이 없으면 "아직 등록된 항목이 없습니다" + "안건 작성" 버튼 강조 |
| Error | 조회/저장 실패 시 `ErrorState` + 재시도 |
| Unauthorized | 비로그인 접근 시 SCR-004로 이동 |
| Saving | 안건 작성/의견 작성/합의 확정 각각 버튼 비활성화 + "저장 중" 텍스트, 제목 1~100자·내용/의견 1~2000자 위반 시 저장 거부 + 사유 텍스트 표시(FR-016, FR-017) |

### 4.5 이동 목적지

- 상단 "대시보드로" 링크 → SCR-001
- 안건 작성 완료 후 → 같은 화면에서 신규 안건이 목록 최상단에 즉시 반영(별도
  화면 이동 없음)

---

## 5. SCR-004 `/login` — 로그인

### 5.1 사용자 목표

두 운영자 중 한 명이 로그인하여 보호된 화면(대시보드, 계좌·종목, 판단 로그)에
접근할 수 있는 상태가 된다. 비로그인 사용자가 보호된 경로에 접근하면 이 화면
으로 유도된다(FR-001, FR-002).

### 5.2 영역 구성과 순서 (Desktop 1440px, 반응형 규칙만 적용)

이 화면은 마케팅 요소(Hero, 제품 소개, 사진/일러스트)를 두지 않는다. 중앙
정렬된 단일 카드만 배치한다.

1. **서비스 이름 텍스트** — 로고 이미지 대신 텍스트 라벨.
2. **로그인 폼 카드** — 이메일/비밀번호 또는 사용하는 인증 수단 입력 필드 +
   주요 버튼(보라, "로그인").
3. **오류 메시지 영역** — 인증 실패 시 카드 내부에 노출, 기술 용어(RLS, 401
   등) 노출 금지.
4. 하단 안내 문구("기준 시점", "참고용 — 투자 권유 아님")는 이 화면에는 없음
   (분석 결과 화면이 아니므로 FR-008, FR-024 대상 아님).

### 5.3 영역별 데이터 항목

이 화면은 자산·안건 데이터를 다루지 않는다. 인증 입력값(이메일 등)과 인증
결과 상태만 다룬다. 인증 실패 시에도 실제 금액 데이터는 어떤 형태로도
포함되지 않는다(FR-002, SC-007).

### 5.4 상태

| 상태 | 처리 |
|---|---|
| Loading | 로그인 버튼 스피너 + 비활성화 |
| Empty | 해당 없음 |
| Error | 인증 실패 시 폼 하단 오류 텍스트("이메일 또는 비밀번호를 확인해 주세요" 등 비기술적 문구) |
| Unauthorized | 이 화면 자체가 Unauthorized 상태의 도착지 |
| Saving | 로그인 시도 중 "로그인 중" 텍스트 + 버튼 비활성화 |

### 5.5 이동 목적지

- 로그인 성공 → SCR-001 `/dashboard`로 이동
- 보호된 경로(SCR-001/002/003) 접근 시도 중 비로그인 상태였다면, 로그인 성공
  후 원래 요청한 경로로 이동

---

## 6. 화면 간 이동 관계 요약

```
SCR-004 (로그인) --성공--> SCR-001 (대시보드)
SCR-001 <--> SCR-002 (계좌·종목 보기 / 대시보드로)
SCR-001 <--> SCR-003 (안건 목록 보기 / 대시보드로)
SCR-002, SCR-003 진입 시 비로그인 --> SCR-004
```

---

## 7. 이 계획서가 다루지 않는 것

- 실제 컴포넌트 구현 코드, 스타일시트 변경
- Task 목록 생성
- SCR-001~004 외 5번째 화면(공개 열람용 화면 등은 spec.md 가정에 따라 범위 외)
- 색·폰트·반경의 신규 정의(전부 `DESIGN.md` / `DESIGN.quantmind.md` /
  `src/styles/tokens.css` 기존 값 참조)

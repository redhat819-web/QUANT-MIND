<!--
Sync Impact Report
- Version change: [TEMPLATE] → 1.0.0 (initial ratification)
- Modified principles: N/A (first concrete adoption; all 17 principles newly defined)
- Added sections:
  - Core Principles I–XVII (권한, 보안, 공개 데이터, 표현/문구, 기록/감사, 데이터 매핑,
    UI 견고성, 범위 통제, 디자인 일관성, 접근성/모션, 반응형 완결성, 추적성, 완료 기준)
  - Governance (amendment procedure, versioning policy, compliance review)
- Removed sections: none (template placeholders replaced, not removed)
- Deferred / TODO placeholders: RATIFICATION_DATE set to today's date (2026-09-05) since no
  prior ratified constitution existed; adjust if an earlier informal agreement date applies.
- Templates requiring follow-up review (not modified by this command):
  - .specify/templates/plan-template.md — verify Constitution Check gates reference these
    17 principles where relevant (e.g., 공개 데이터 원칙, 인증 세션 원칙, 문구 원칙).
  - .specify/templates/spec-template.md — no direct dependency detected.
  - .specify/templates/tasks-template.md — verify task template supports requirement/design
    traceability fields per Principle XVI.

Sync Impact Report (this amendment)
- Version change: 1.0.0 → 1.1.0 (principle additions, no removals/redefinitions)
- Modified principles: none (all prior 17 principles preserved verbatim)
- Added sections:
  - Core Principles XVIII–XXIV (DESIGN.md/Kraken 기준, DESIGN.md 원본 불변,
    DESIGN.quantmind.md 우선순위, 등락 색상 규칙, 시스템 상태와 시장 데이터 색 체계 분리,
    상표 폰트/자산 비복제, 수치 표기 형식)
- Removed sections: none
- Deferred / TODO placeholders: none
- Templates requiring follow-up review (not modified by this command):
  - .specify/templates/plan-template.md — verify Constitution Check gates reference the new
    디자인 기준 원칙(XVIII–XXIV), especially DESIGN.quantmind.md 우선순위 확인 절차.
  - .specify/templates/spec-template.md — no direct dependency detected.
  - .specify/templates/tasks-template.md — no direct dependency detected.
-->

# QUANT-MIND 공동 자산 관리 대시보드 Constitution

## Core Principles

### I. 동등한 운영자 권한 (Equal Operator Authority)
두 운영자(부부)는 시스템 내에서 완전히 동등한 권한을 가진다. 어느 한쪽도 상위 관리자,
승인권자, 또는 최종 결정권자로 설정되지 않는다. 승인/거부 워크플로우, 역할 계층, 또는
한쪽만 실행 가능한 특권 동작을 설계하거나 구현하지 않는다.

**이유**: 이 도구는 부부의 공동 자산 논의를 지원하는 것이 목적이며, 한쪽에게 권한을
집중시키는 구조는 프로젝트의 근본 취지(대등한 협의)를 훼손하고 신뢰를 해친다.

**검토 기준**: 코드 리뷰 시 사용자 역할(role) 필드나 권한 분기 로직이 두 운영자 계정 간에
비대칭적으로 존재하지 않는지 확인한다. 신규 기능이 "승인", "잠금 해제", "관리자 전용"과
같은 상하 구조를 암시하는 용어를 사용하면 반려한다.

### II. 인증 세션 전용 금액 반환 (Authenticated-Only Amount Disclosure)
실제 계좌 잔액, 보유 수량, 평가금액 등 금액과 직접 연결된 데이터는 인증된 세션의 서버
응답에서만 반환한다. 인증되지 않은 요청에 대해 금액 필드를 포함한 응답을 CSS/화면에서
숨기거나 흐림 처리(blur)하는 방식으로 대체해서는 안 된다.

**이유**: 클라이언트에서 값을 숨기는 방식은 개발자 도구나 네트워크 탭에서 그대로 노출되어
실질적인 보호가 되지 않는다. 데이터는 응답 페이로드 단계에서 차단되어야 한다.

**검토 기준**: 인증되지 않은 상태로 API를 직접 호출했을 때 응답 본문에 금액 관련 필드가
전혀 포함되지 않아야 한다(값이 0, null, 마스킹 문자열이어도 필드 자체가 존재하면 위반).

### III. 공개 화면 데이터의 금액 배제 (No Amounts in Public Data)
인증 없이 접근 가능한 화면(공개 화면)이 사용하는 데이터 소스(API 응답, 정적 데이터,
props)에는 금액 항목 자체가 포함되지 않는다. 금액을 다른 형태(비율, 등급, 색상 라벨 등)로
가공해도 원본 금액에서 파생된 값이 역산 가능하다면 이는 금액 노출로 간주한다.

**이유**: 원칙 II와 이중 방어선을 이루어, 프런트엔드 로직 오류가 발생해도 공개 화면
자체가 애초에 금액 정보를 받지 않으므로 노출이 구조적으로 불가능하다.

**검토 기준**: 공개 화면에 연결된 API 스키마를 검사하여 금액/잔액/평가액 필드가
정의조차 되어 있지 않은지 확인한다.

### IV. 비밀정보의 환경변수 전용 관리 (Secrets via Environment Variables Only)
API 키, 인증 토큰, 시크릿 등은 코드, 설정 파일, 커밋 이력에 직접 기록하지 않는다.
모든 비밀정보는 환경변수(또는 이에 준하는 시크릿 관리 도구)를 통해서만 주입한다.

**이유**: 코드에 하드코딩된 비밀정보는 저장소가 비공개라도 유출 시 회복이 어렵고,
버전 관리 이력에 영구히 남는다.

**검토 기준**: 코드 검색(grep)으로 실제 키 패턴이나 토큰 문자열이 소스에 존재하지 않는지
확인하고, `.env` 계열 파일이 `.gitignore`에 포함되어 있는지 확인한다.

### V. 참고용 고지 문구 필수 표기 (Mandatory Reference-Only Disclaimer)
모든 분석 결과 화면에는 "참고용 — 투자 권유 아님" 문구를 사용자가 인지할 수 있는
위치에 표기한다. 문구가 스크롤 이후에만 보이거나 시각적으로 무시할 수준으로 축소되어서는
안 된다.

**이유**: 이 도구는 개인 간 논의 보조 수단이며, 투자 자문이나 권유로 오인될 경우
법적·윤리적 위험과 사용자 오판 가능성이 생긴다.

**검토 기준**: 분석 결과를 표시하는 모든 화면/컴포넌트에서 해당 문구가 렌더링되는지
스냅샷 또는 접근성 트리로 확인한다.

### VI. 시나리오 제시 원칙 (Scenario-Presentation, Not Advice)
투자 권유, 매수/매도 지시, 확정적 예측을 의미하는 표현을 사용하지 않는다. 판단이나
전망은 "~라면 ~할 수 있음", "가능한 시나리오" 등 조건부·시나리오 제시 형태로만
표현한다.

**이유**: 확정적 표현은 사용자가 이를 전문 자문으로 오인하게 만들며, 이는 원칙 V의
고지 문구와 모순되는 경험을 만든다.

**검토 기준**: UI 카피 및 분석 텍스트 생성 로직에서 "매수하세요", "지금이 기회입니다"류의
명령형/확정형 문장이 없는지 문구 검수 체크리스트로 확인한다.

### VII. 판단 기록의 작성자·시각 기록 (Authorship and Timestamp on Every Judgment)
두 운영자가 남기는 모든 판단·의견·합의 기록에는 작성자 식별 정보와 작성 시각이
함께 저장되고 표시된다. 익명 또는 시각 정보 누락 기록은 허용하지 않는다.

**이유**: 공동 의사결정 도구에서 누가 언제 어떤 판단을 남겼는지는 이후 합의를 되짚어보는
핵심 근거이며, 이것이 없으면 기록의 신뢰성이 사라진다.

**검토 기준**: 기록 생성 API/스키마에 `author`, `created_at`(또는 동등 필드)이 NOT NULL로
강제되어 있는지 확인한다.

### VIII. 합의 확정 기록의 변경 이력 보존 (Immutable History on Confirmed Records)
합의가 확정된 기록을 이후 수정할 경우, 원본을 덮어쓰지 않고 변경 이력(이전 값, 수정자,
수정 시각, 사유)을 남긴다.

**이유**: 확정된 합의는 부부 간 신뢰의 기준점이 되므로, 조용히 수정되면 분쟁이나
오해의 소지가 생긴다. 이력 보존은 이를 방지하는 최소한의 장치다.

**검토 기준**: 확정 상태(confirmed/agreed) 레코드에 대한 수정 요청이 새 이력 엔트리를
생성하는지, 그리고 이전 상태를 조회할 수 있는지 확인한다.

### IX. 원본 스프레드시트 형식 존중과 매핑 흡수 (Format Diversity via Mapping, Not Coercion)
각 운영자가 사용하는 원본 스프레드시트의 열 구성, 이름, 순서를 강제로 통일하지 않는다.
서로 다른 형식은 각자에 대한 매핑 정의(컬럼 매핑, 타입 변환 규칙)를 통해 공통 내부
모델로 흡수한다.

**이유**: 두 사람이 서로 다른 증권사·양식을 사용하는 것이 자연스러운 전제이며, 형식을
강제로 맞추라고 요구하면 실제 사용성이 떨어져 도구가 방치된다.

**검토 기준**: 신규 데이터 소스 추가 시 기존 스프레드시트의 원본 구조 변경 없이 매핑
설정 파일/규칙만 추가하여 연동이 가능한지 확인한다.

### X. 조건부 표시 항목의 빈 상태 견고성 (Graceful Empty States for Conditional Items)
화면에 조건부로 표시되는 항목(예: 특정 계좌에만 존재하는 자산 유형, 아직 기록되지 않은
합의 항목)이 비어 있는 경우에도 화면은 오류 없이 정상적으로 성립해야 한다.

**이유**: 두 사람의 데이터는 항상 비대칭적일 수 있으므로(한쪽에만 있는 자산 등), 빈
데이터를 예외 상황이 아닌 정상 상태로 취급해야 한다.

**검토 기준**: 조건부 항목이 0개/null/빈 배열인 케이스를 각 화면에서 테스트하여 레이아웃
깨짐, 콘솔 에러, 무한 로딩이 발생하지 않는지 확인한다.

### XI. 명세 범위 준수 (Scope Discipline During Implementation)
구현 도중 명세(spec)에 없는 기능을 임의로 추가하지 않는다. 필요성이 발견되면 먼저
명세를 갱신하거나 사용자에게 확인한 뒤 구현한다.

**이유**: 임의 기능 추가는 두 원칙 없는 확장을 낳아 유지보수 부담과 일관성 붕괴로
이어지며, 공동 합의 기반 도구의 취지와도 어긋난다(합의되지 않은 기능이 임의로 생김).

**검토 기준**: 완료된 Task가 대응하는 명세 항목을 명확히 가리키는지 확인하고, 명세에
근거가 없는 코드 변경은 별도 명세 갱신 없이는 병합하지 않는다.

### XII. 핵심 화면 정보 구조·디자인 일관성 (Consistency Across the Three Core Screens)
세 핵심 화면(예: 대시보드, 상세/분석, 기록 화면)은 정보 구조(레이아웃 위계, 내비게이션
패턴)와 디자인 요소(타이포그래피, 간격, 컴포넌트 스타일)에서 일관성을 유지한다.

**이유**: 두 사람이 매번 다른 방식으로 화면을 해석해야 한다면 공동 사용의 편의성이
떨어지고 학습 비용이 늘어난다.

**검토 기준**: 세 화면의 디자인 토큰(색상, 폰트, 여백)과 내비게이션 구조를 비교하여
동일한 패턴 라이브러리/컴포넌트를 재사용하고 있는지 확인한다.

### XIII. 상태의 색상+텍스트 이중 표현 (Status via Color and Text Together)
화면상의 상태 표시(예: 합의 완료/보류, 상승/하락)는 색상만으로 구분하지 않고 항상
텍스트 라벨을 함께 제공한다.

**이유**: 색상만으로 구분하면 색각 이상 사용자나 저채도 화면 환경에서 정보가 전달되지
않아 접근성이 훼손된다.

**검토 기준**: 상태를 나타내는 모든 UI 요소에서 색상 제거 시(그레이스케일 렌더링) 텍스트
만으로도 상태를 판별할 수 있는지 확인한다.

### XIV. 모션 감소 설정 존중 (Respecting prefers-reduced-motion)
모든 애니메이션과 전환 효과는 `prefers-reduced-motion` 사용자 설정을 감지하여, 해당
설정이 활성화된 경우 애니메이션을 제거하거나 최소화한다.

**이유**: 전정기관 민감성이나 주의력 문제가 있는 사용자에게 불필요한 모션은 불편함이나
어지러움을 유발할 수 있다.

**검토 기준**: `prefers-reduced-motion: reduce` 환경에서 각 화면을 렌더링했을 때 핵심
애니메이션(트랜지션, 자동 슬라이드 등)이 비활성화되거나 즉시 완료되는지 확인한다.

### XV. 데스크톱·모바일 핵심 시나리오 완결성 (Cross-Device Scenario Completion)
핵심 사용자 시나리오(자산 조회, 판단 기록, 합의 확인 등)는 데스크톱과 모바일 양쪽
환경에서 처음부터 끝까지 중단 없이 완료될 수 있어야 한다.

**이유**: 부부가 각자 다른 기기(예: 한 명은 데스크톱, 한 명은 모바일)로 접속해 동일한
논의에 참여하는 것이 일반적인 사용 패턴이다.

**검토 기준**: 각 핵심 시나리오를 데스크톱 뷰포트와 모바일 뷰포트 각각에서 수동 또는
자동화 테스트로 처음부터 끝까지 수행하여 완료 가능 여부를 확인한다.

### XVI. Task의 요구사항·디자인 추적성 (Traceable Tasks)
모든 구현 Task는 어떤 요구사항(스펙 항목)과 어떤 디자인 근거(디자인 문서/화면 정의)에
대응하는지 명시적으로 추적 가능해야 한다.

**이유**: 추적성이 없으면 Task가 왜 존재하는지, 완료 기준이 무엇인지 판단할 수 없고,
원칙 XI(명세 범위 준수)를 검증할 방법도 사라진다.

**검토 기준**: 각 Task 항목에 대응 요구사항 ID 또는 디자인 문서 참조가 기재되어 있는지
확인하고, 근거 없는 Task는 생성 전에 반려한다.

### XVII. 실패한 테스트·빌드의 완료 처리 금지 (No Completion Without Passing Tests/Build)
테스트 또는 빌드가 실패한 작업은 완료(done) 상태로 처리하지 않는다. 실패 원인을
해결하거나, 해결이 불가능한 경우 명시적으로 보류 상태로 남긴다.

**이유**: 실패 상태를 완료로 처리하면 이후 작업이 잘못된 기반 위에서 진행되어 오류가
누적되고, 공동 자산 데이터를 다루는 도구의 신뢰성이 근본적으로 훼손된다.

**검토 기준**: Task를 완료 처리하기 전에 CI 또는 로컬 테스트/빌드 실행 결과가 성공
상태인지 확인하고, 실패 로그가 남아 있으면 완료 처리를 차단한다.

### XVIII. DESIGN.md(Kraken)를 UI 기본 시각 기준으로 채택 (Kraken as Default Visual Baseline)
프로젝트 루트의 `DESIGN.md`(코드네임 Kraken)를 UI의 기본 시각 기준(타이포그래피, 색상,
레이아웃 그리드, 컴포넌트 스타일의 출발점)으로 사용한다. 신규 화면/컴포넌트 설계 시
별도 근거 없이 이 기준에서 벗어나지 않는다.

**이유**: 여러 화면과 작업자가 각자 다른 시각 기준을 임의로 세우면 원칙 XII(핵심 화면
일관성)가 무너진다. 단일 기준 문서를 두어 판단 비용을 줄인다.

**검토 기준**: 신규 컴포넌트의 색상/타이포그래피/여백 값이 `DESIGN.md`에 정의된 토큰과
일치하거나, 벗어난 경우 `DESIGN.quantmind.md`에 근거가 명시되어 있는지 확인한다.

### XIX. DESIGN.md 원본 불변 (DESIGN.md Is Read-Only)
`DESIGN.md` 원본 파일은 수정하지 않는다. 이 문서에 대한 변경 필요가 발견되면
`DESIGN.md`를 직접 고치지 않고 `DESIGN.quantmind.md`에 별도로 기록한다.

**이유**: `DESIGN.md`는 외부(Kraken) 출처의 기준 문서로 취급되며, 로컬에서 직접 수정하면
향후 원본 갱신 시 병합 충돌과 출처 추적 불가 문제가 생긴다.

**검토 기준**: 커밋/PR diff에 `DESIGN.md` 변경이 포함되어 있으면 반려한다.

### XX. DESIGN.quantmind.md의 우선순위와 충돌 기록 (Project Overrides Take Precedence, Recorded)
`DESIGN.quantmind.md`는 `DESIGN.md`보다 우선한다. 두 문서의 지침이 서로 다를 경우
`DESIGN.quantmind.md`를 따르며, 그 충돌 사실(무엇이 다른지, 왜 다른지)을
`DESIGN.quantmind.md` 안에 명시적으로 기록한다.

**이유**: 원본을 그대로 보존하면서(원칙 XIX) 프로젝트 고유의 예외를 반영하려면, 예외의
근거와 범위를 기록한 별도 문서가 필요하다. 기록 없는 예외는 이후 왜 벗어났는지 추적할
수 없게 된다.

**검토 기준**: `DESIGN.quantmind.md`에 정의된 값이 `DESIGN.md`와 다를 때마다 해당 항목
근처에 충돌 근거 설명이 함께 있는지 확인한다.

### XXI. 등락 색상 규칙: 상승 빨강 / 하락 파랑 (Market Movement Color Convention)
등락(가격/수익률 상승·하락) 표시는 상승을 빨강, 하락을 파랑으로 표현한다. 초록은
시스템 성공 상태(예: 저장 완료, 연동 성공) 표시에만 사용하며, 등락 표시에는 사용하지
않는다.

**이유**: 초록/빨강을 등락과 시스템 상태 양쪽에 혼용하면 사용자가 "성공했다"는 의미와
"가격이 올랐다"는 의미를 혼동할 수 있다. 두 의미 체계를 분리해 오독을 방지한다.

**검토 기준**: 등락을 표시하는 모든 컴포넌트에서 상승=빨강, 하락=파랑 토큰이 사용되고
초록 토큰이 등장하지 않는지 확인한다. 이 원칙은 원칙 XIII(색상+텍스트 이중 표현)와
함께 적용된다.

### XXII. 시스템 상태와 시장 데이터의 색 체계 분리 (Separate Color Systems, Separate Components)
시스템 상태 표시(`StatusBadge` 등)와 시장 데이터(등락) 표시는 서로 다른 색 체계를
사용하며, 하나의 컴포넌트를 공유하지 않는다. 등락 표시에는 `StatusBadge`를 재사용하지
않고 전용 컴포넌트를 사용한다.

**이유**: 컴포넌트를 공유하면 색상 팔레트가 뒤섞여 원칙 XXI의 규칙을 우회하기 쉬워지고,
향후 한쪽 체계를 변경할 때 다른 쪽에 의도치 않은 영향을 준다.

**검토 기준**: 코드베이스에서 등락 표시가 `StatusBadge`(또는 시스템 상태 전용
컴포넌트)를 직접 호출하지 않는지 확인한다.

### XXIII. 전용 상표 폰트·브랜드 자산 비복제 (No Cloning of Proprietary Brand Assets)
`DESIGN.md`(Kraken) 또는 그 밖의 참조 자료에 포함된 전용 상표 폰트, 로고, 브랜드 전용
그래픽 자산은 복제하거나 그대로 재사용하지 않는다. 시각적 톤을 참고하되, 실제 구현에는
라이선스가 명확한 대체 폰트와 자체 자산을 사용한다.

**이유**: 상표 폰트나 브랜드 자산을 그대로 복제하면 지식재산권 문제가 발생할 수 있고,
이 프로젝트는 해당 상표와 무관하다.

**검토 기준**: 번들에 포함된 폰트 파일/에셋의 라이선스를 확인하여 전용 상표 폰트나
브랜드 전용 자산이 포함되어 있지 않은지 점검한다.

### XXIV. 수치 표기 형식: Tabular Figures·우측 정렬·고정 소수점 (Numeric Display Format)
화면에 표시되는 모든 수치(금액, 수량, 비율 등)는 tabular figures(고정폭 숫자)로
렌더링하고, 우측 정렬하며, 고정된 소수점 자리수로 표시한다. 자리수가 항목마다 달라
흔들리는 표시를 허용하지 않는다.

**이유**: 숫자가 세로로 정렬되지 않으면 표 형태의 데이터를 빠르게 비교하기 어렵고,
자리수가 흔들리면 오독 가능성이 커진다.

**검토 기준**: 수치를 표시하는 컴포넌트에서 `font-variant-numeric: tabular-nums`(또는
동등 설정)가 적용되어 있는지, 텍스트 정렬이 우측인지, 소수점 자리수가 항목 유형별로
고정되어 있는지 확인한다.

## 보안 및 데이터 노출 정책
<!-- 원칙 II, III, IV의 구체적 적용 지침을 다룸 -->

인증 경계는 API 게이트웨이 또는 서버 레이어에서 강제되며, 프런트엔드는 신뢰할 수 있는
경계로 취급하지 않는다. 모든 신규 엔드포인트는 인증 필요 여부와 반환 필드 목록을
명시적으로 문서화해야 하며, 공개 엔드포인트에는 금액 관련 필드를 스키마 수준에서
정의하지 않는다. 비밀정보 관리는 `.env` 및 배포 환경의 시크릿 스토어로 한정하고,
새 통합(증권사 API, 알림 서비스 등) 추가 시에도 이 정책을 동일하게 적용한다.

## 개발 워크플로우 및 품질 게이트
<!-- 원칙 XI, XVI, XVII의 실행 절차를 다룸 -->

기능 구현은 spec → plan → tasks 순서를 따르며, 각 Task는 완료 처리 전에 (1) 대응
요구사항/디자인 근거 확인, (2) 관련 테스트 통과, (3) 빌드 성공을 모두 만족해야 한다.
셋 중 하나라도 충족되지 않으면 해당 Task는 진행 중(in progress) 또는 보류(blocked)
상태로 유지한다. 명세에 없는 범위 확장이 필요하다고 판단되면 구현을 멈추고 먼저 명세
갱신 여부를 사용자와 확인한다.

## Governance

본 헌장은 QUANT-MIND 프로젝트의 다른 모든 관행, 템플릿, 개별 합의보다 우선한다.
충돌이 발생하면 본 헌장의 원칙이 적용된다.

**개정 절차**: 원칙의 추가, 삭제, 재정의는 두 운영자 중 누구나 제안할 수 있으며,
두 운영자의 명시적 동의가 있어야 발효된다(원칙 I과 동일하게 한쪽의 일방적 개정은
허용하지 않는다). 개정 시 본 파일 상단에 Sync Impact Report를 갱신하고 버전을 아래
규칙에 따라 올린다.

**버전 관리 정책**: 시맨틱 버저닝(MAJOR.MINOR.PATCH)을 따른다.
- MAJOR: 기존 원칙의 제거 또는 양립 불가능한 재정의.
- MINOR: 새 원칙 추가 또는 기존 원칙의 실질적 확장.
- PATCH: 표현 수정, 오탈자 수정 등 의미 변화 없는 명확화.

**준수 검토**: 각 기능의 plan 및 PR 리뷰 시 관련 원칙의 "검토 기준"을 체크리스트로
사용하여 위반 여부를 확인한다. 위반이 발견되면 병합 전에 해결하거나, 불가피한 경우
그 사유와 완화 조치를 plan 문서에 명시적으로 기록한다(Complexity Tracking에 준함).

**Version**: 1.1.0 | **Ratified**: 2026-09-05 | **Last Amended**: 2026-09-12

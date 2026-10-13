# Implementation Plan: 부부 가입·연결 온보딩 (상용화 기반)

**Branch**: `002-household-onboarding` | **Date**: 2026-10-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-household-onboarding/spec.md`

## Summary

불특정 부부가 스스로 가입하고, household를 만들고, 배우자를 초대해 합류하게 한다. 각자 자산을 서비스
표준 양식(.xlsx)으로 올리고, 배우자 공개에 동의한 뒤에만 상대에게 금액이 보인다. 탈퇴하면 7일 동안
양쪽이 내보낼 수 있고, 그 뒤 떠난 사람의 자산과 작성 기록을 삭제한다. 분석 도구(GA4)는 동의한 일반
사용자에게만 불러오고, household 단위 지표(Activation, NSM)는 서버 기록으로 센다.

기술 방식은 001을 잇는다. React SPA와 Supabase(Auth, Postgres, RLS, RPC, pg_cron)만 쓰고 별도 백엔드
서버는 두지 않는다. 결정 근거는 [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5.x(strict), Node.js 20 LTS(빌드), PL/pgSQL(RPC·트리거)

**Primary Dependencies**:
- 001과 같음: React 18, Vite 5, `@supabase/supabase-js` v2, React Router 6, TanStack Query 5, Zod, MSW,
  Vitest, Testing Library, Playwright
- 추가: `read-excel-file`, `write-excel-file`(MIT, 양식 읽기·내보내기, R5·R7), GA4 gtag(동적 로드, R8)
- DB 확장: `pg_cron`(탈퇴 삭제 예약 실행, R10)

**Storage**: Supabase PostgreSQL. 001 테이블에 컬럼 추가와 새 테이블 7개(`data-model.md`). 업로드한
파일 원본은 저장하지 않는다.

**Testing**: Vitest(단위), `npm run test:integration`(RPC·RLS, 테스트 계정 환경변수), Playwright(mock
모드, 데스크톱·모바일). R14 참조

**Target Platform**: 모던 브라우저(데스크톱·모바일 웹). 실서비스는 별도 정적 호스팅, GitHub Pages는
mock 데모 유지(R11)

**Project Type**: Web application(SPA + BaaS, 별도 백엔드 없음)

**Performance Goals**:
- 업로드 500행의 브라우저 검증과 반영이 사용자 체감 3초 이내
- 가입부터 household 생성까지 인증 대기를 빼고 5분 이내(SC-001), 합류 5분 이내(SC-002)

**Constraints**:
- 금액은 인증된 세션에서, 그리고 공개 동의가 있을 때만 응답에 포함한다(원칙 II, FR-012)
- 고객 흐름에 비밀 키가 없어야 한다(원칙 IV, FR-010)
- 분석 동의 없이는 분석 요청 0건(FR-019)
- deploy.yml의 mock 강제를 유지한다(AGENTS.md)
- 001 기능의 동작과 규칙은 바꾸지 않는다

**Scale/Scope**:
- 초기 가정은 household 1,000개 이하, household당 2명, 1인당 업로드 최대 500행
- 새 화면: 가입, 약관·동의, household 생성, 초대 수락, 설정(동의·내보내기·탈퇴), 업로드

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

기준은 **현재 효력이 있는 헌장 1.1.0**이다. 개정 제안 2.0.0(원칙 I·VII·VIII·IX)은 상대 운영자 동의 전이라
미발효이며, 발효 시의 판정도 함께 적는다.

| 원칙 | 이번 계획의 반영 | 1.1.0 판정 | 2.0.0 발효 시 |
|---|---|---|---|
| I. 동등한 운영자 권한 | 생성자 전용 권한 없음. 초대·취소·탈퇴를 두 구성원 모두 할 수 있음(R2). role 컬럼 없음 | PASS | PASS |
| II. 인증 세션 전용 금액 반환 | 공개 동의 전에는 RLS로 상대 금액 행을 아예 반환하지 않음(R4) | PASS | PASS |
| III. 공개 데이터의 금액 배제 | 가입·로그인·초대 화면은 금액을 받지 않음. `get_invitation_status`는 상태만 반환 | PASS | PASS |
| IV. 비밀정보 환경변수 관리 | 고객은 비밀 키를 다루지 않음. GA 측정 ID·anon key는 빌드 환경변수 | PASS | PASS |
| V. 참고용 고지 | 대시보드 변경 없음. 업로드 결과 화면에도 고지 유지 | PASS | PASS |
| VI. 시나리오 제시 원칙 | 분석·추천 기능 없음. 문구 검수만 | PASS | PASS |
| VII. 작성자·시각 기록 | 탈퇴 처리 시 합의·이력의 작성자 참조를 null("떠난 구성원")로 바꾸고, 떠난 사람이 쓴 기록은 삭제(R10) | **위반 — Complexity Tracking** | PASS(예외 조항) |
| VIII. 합의 기록 이력 보존 | 탈퇴자 기록과 그 이력을 삭제. 7일 내보내기 기간, 사전 안내, 취소 가능(R10) | **위반 — Complexity Tracking** | PASS(예외 조건 충족) |
| IX. 원본 형식 존중과 매핑 흡수 | 새 사용자는 서비스 표준 양식으로 받음. 기존 운영자 시트 매핑은 유지(R5·R6) | **위반 — Complexity Tracking** | PASS |
| X. 빈 상태 견고성 | 상대 미공개, 업로드 전, 합류 전, 탈퇴 기간을 정상 상태로 표시 | PASS | PASS |
| XI. 명세 범위 준수 | spec 범위 밖(결제, 추천, 마이데이터, 가격 자동 갱신)은 다루지 않음 | PASS | PASS |
| XII. 핵심 화면 일관성 | 새 화면은 기존 AppShell·토큰·공통 컴포넌트를 재사용 | PASS | PASS |
| XIII. 색상+텍스트 이중 표현 | 초대·탈퇴·업로드 상태는 `StatusBadge`(텍스트 포함) 사용 | PASS | PASS |
| XIV. 모션 감소 | 새 전환 효과 없음. 전역 규칙 유지 | PASS | PASS |
| XV. 데스크톱·모바일 완결성 | 온보딩 e2e를 두 뷰포트에서 실행 | PASS | PASS |
| XVI. Task 추적성 | tasks.md에 FR/SC와 contracts 절 참조 | PASS(tasks 단계 적용) | 같음 |
| XVII. 실패 시 완료 금지 | 001 CI 게이트 유지 | PASS | PASS |
| XVIII~XXIV. 디자인 기준 | 새 화면도 `tokens.css`·`DESIGN.quantmind.md`를 따름. 등락 색은 새 화면에 없음 | PASS | PASS |

**게이트 결과**: 위반 3건(VII, VIII, IX)은 아래 Complexity Tracking에 사유와 완화 조치를 기록했다.
헌장 Governance("불가피한 경우 사유와 완화 조치를 plan에 명시")에 따라 Phase 0·1을 진행했다.
**구현(tasks 착수) 전에 2.0.0 발효 여부를 다시 확인한다.** 발효되지 않으면 해당 작업(R5 업로드, R10
삭제)은 보류한다.

**Phase 1 후 재확인**: data-model·contracts가 위 판정과 일치한다. 공개 동의 RLS(II), 초대 상태
응답(III), 분석 게이트(FR-019)를 contracts에 명시했다. 새 위반은 없다.

## Project Structure

### Documentation (this feature)

```text
specs/002-household-onboarding/
├── spec.md
├── plan.md              # 이 문서
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── rpc.md
│   ├── asset-template-v1.md
│   ├── analytics-events.md
│   └── export-files.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks에서 생성(아직 없음)
```

### Source Code (repository root)

001 구조를 그대로 쓰고 아래를 더한다.

```text
src/
├── app/
│   ├── routes.tsx                     # /signup, /onboarding/*, /invite, /settings 추가
│   └── providers/
│       └── AnalyticsProvider.tsx       # 동의·내부·모드 게이트, gtag 동적 로드(R8)
├── pages/
│   ├── SignupPage.tsx
│   ├── OnboardingPage.tsx              # 약관 동의 → household 생성 → 초대 안내
│   ├── InviteAcceptPage.tsx
│   └── SettingsPage.tsx                # 동의 관리, 내보내기, 탈퇴
├── features/
│   ├── household/                      # 생성·초대·수락·탈퇴 (api, hooks, components)
│   ├── consent/                        # 약관·공개·분석 동의
│   ├── asset-upload/                   # 양식 내려받기, xlsx 파싱·검증, 업로드
│   └── export/                         # 자산·판단 로그 xlsx 내보내기
├── lib/
│   ├── analytics.ts                    # 이벤트 전송(허용 속성만 통과)
│   └── validation/assetTemplate.ts     # 양식 v1 zod 스키마
└── mocks/                              # 새 흐름의 MSW 핸들러·fixture

public/templates/quantmind-asset-template-v1.xlsx

supabase/migrations/                    # 002 컬럼·테이블·RLS·RPC·pg_cron 등록

tests/
├── unit/                               # 양식 검증, 내보내기 왕복, 분석 게이트
├── integration/                        # RPC·RLS (QM_IT_* 환경변수)
└── e2e/                                # 온보딩 전체 흐름(mock, 데스크톱·모바일)
```

**Structure Decision**: 001과 같은 단일 SPA + BaaS 구조를 유지한다. 새 기능은 `src/features/` 아래 4개
모듈로 나눈다. DB 쪽 규칙(정원, 공개, 삭제)은 모두 `supabase/migrations/`의 RLS·RPC에 둔다.
Apps Script(`apps-script/`)는 바꾸지 않는다.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| 원칙 VII: 탈퇴 처리 시 합의·이력의 작성자 참조를 null로 바꾸고 떠난 사람의 기록을 삭제 | Clarification Q2(2026-10-11): 탈퇴자의 기록은 개인 영역이므로 삭제. 개인정보 삭제 요구에 응해야 함 | 원문 유지(작성자 "떠난 구성원") — 사용자가 삭제를 선택해 기각. 시각 정보는 유지해 위반 범위를 줄임 |
| 원칙 VIII: 확정 합의와 그 변경 이력 삭제 | 같음 | 완화 조치: 7일 내보내기 기간, 양측 내보내기, 사전 안내, 기간 중 취소 가능, 기간 전 삭제 0건(SC-010). 개정안 2.0.0 VIII의 예외 조건과 같다 |
| 원칙 IX: 새 사용자 자산을 개인 원본 형식이 아닌 표준 양식으로 받음 | Clarification Q1(2026-10-11): 개인 형식은 너무 개인적이라 일반 서비스에 맞지 않음 | 개인별 매핑 — 불특정 사용자마다 매핑 정의를 만들 수 없어 기각. 완화 조치: 기존 두 운영자의 시트 매핑은 유지(R6), 미매핑 종목 표시 유지, 양식 버전 호환 |

세 항목 모두 헌장 개정 제안 2.0.0(`.specify/memory/constitution.md`의 "개정 제안" 절)에 반영되어 있다.
발효되면 이 표의 항목은 위반이 아니게 된다.

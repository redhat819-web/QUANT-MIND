# 분석 이벤트 계약 (GA4)

## 전송 조건

아래 세 조건을 **모두** 만족할 때만 gtag 스크립트를 불러오고 이벤트를 보낸다(research R8, FR-019).

1. `user_profile.analytics_opt_in = true` (로그인 전 화면에서는 브라우저에 저장한 동의 선택값으로
   판단하고, 기본값은 동의 안 함)
2. `user_profile.is_internal = false`
3. `VITE_DATA_SOURCE = supabase`

어느 하나라도 아니면 스크립트를 불러오지 않는다. 동의를 철회하면 이후 전송을 멈추고 `_ga*` 쿠키를
지운다.

## 공통 설정

- `send_page_view: false`. page_view는 아래 경로 패턴으로만 직접 보낸다.
- `user_id`는 설정하지 않는다.
- 공통 속성: `data_source`(`supabase` 고정, mock에서는 전송 자체가 없음)

## page_view 경로 패턴

| 실제 경로 | 보내는 `page_location` 경로 |
|---|---|
| `/signup`, `/login` | 같음 |
| `/invite#<token>` | `/invite` (토큰 제외) |
| `/onboarding/*` | 같음 |
| `/dashboard`, `/holdings`, `/judgment-log`, `/settings` | 같음 |

## 이벤트 (모두 성공 시점에만, 한 번)

| 이벤트 | 발생 조건 | 위치(예정) | 허용 속성 | 미발생 조건 |
|---|---|---|---|---|
| `signup_complete` | 이메일 인증을 마치고 처음 로그인 | AuthProvider 세션 확인 | `method: 'email'` | 가입 폼 제출, 인증 전 |
| `household_create_success` | `create_household` 성공 | 온보딩 생성 mutation `onSuccess` | 없음 | 요청만 보냄, P0010/P0011 |
| `partner_invite_send` | `create_invitation` 성공 | 초대 mutation `onSuccess` | `channel: 'link'` | 버튼 클릭만, P0012 |
| `partner_invite_accept` | `accept_invitation` 성공 | 초대 수락 mutation `onSuccess` | 없음 | 링크 열기만, P0011~P0013 |
| `data_connect_success` | `replace_my_assets` 성공 | 업로드 mutation `onSuccess` | `source_type: 'template_xlsx'`, `template_version` | 클라이언트 검증 실패, P0014/P0015 |
| `first_sync_success` | 위 성공이 이 구성원의 **첫** `applied` 업로드 | 같음(응답의 첫 업로드 여부로 판단) | `source_type` | 두 번째 이후 업로드 |

## 보내지 않는 값

금액·수익률·비중·종목명·계좌명, 안건·의견·사유 본문, 이메일, 사용자·household·초대 식별자, 초대 토큰,
날짜 값, 국가·지역 커스텀 속성, 오류 메시지 원문.

## household 단위 지표

GA4로 계산하지 않는다. `activation_record`, `asset_upload`, `departure_request`, `consent_record`의 서버
집계로 계산한다(research R9). 지표 정의는 `docs/ACTIVATION_DEFINITION.md`, `docs/NORTH_STAR_METRIC.md`.

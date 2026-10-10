# AGENTS.md

요구사항 정본은 `specs/001-quant-mind-dashboard/spec.md`, 진행 상태는 같은 폴더의 `tasks.md`다.
아래 규칙의 근거는 `docs/USER_FLOW_ANALYSIS.md`에 있다.

## 사용자 행동과 저장

- 클릭, 유효 제출(검증 통과), 저장 성공은 서로 다른 단계로 다룬다. 폼을 닫거나 입력을 비우는
  일은 mutation의 `onSuccess`에서 한다. mutate를 호출한 직후에 하지 않는다.
  왜: 저장이 실패하면 입력이 사라지고, 사용자는 저장됐다고 오해한다.
- mutation이 실패하면 화면에 오류와 재시도 수단을 보여준다. 실패한 뒤 값만 원래대로 돌아가게
  두지 않는다.
  왜: spec Edge Case가 "오류 상태 표시 + 재시도"를 요구한다.
- 분석 이벤트를 추가할 때도 위 단계를 서로 다른 이벤트로 나눈다(예: `agenda_submit_click`,
  `agenda_save_success`).
  왜: 클릭 수만 세면 실제로 저장된 수를 알 수 없다.

## 데이터 소스와 실데이터

- 데이터 훅은 `useDataSource()`로 mock과 supabase 두 모드를 모두 처리한다. 한쪽만 구현했다면
  `tasks.md`에 미완료 작업으로 남긴다.
  왜: supabase 모드에서는 MSW가 켜지지 않아서 `/mock-api` 호출이 실패한다.
- 브라우저 코드에는 anon key만 둔다. service role key는 Apps Script에서만 쓴다. 공개용 뷰에는
  금액 컬럼을 넣지 않는다(FR-004).
- `.github/workflows/deploy.yml`의 "mock 강제" 검사는 Supabase 연동이 끝나기 전까지 지우거나
  우회하지 않는다.
  왜: GitHub Pages는 공개 사이트다.

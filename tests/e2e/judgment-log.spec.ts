import { expect, test } from '@playwright/test'
import { loginAsMockUser } from './helpers/login'

/**
 * User Story 3 Given-When-Then 시나리오(spec.md Acceptance Scenarios).
 * 데스크톱/모바일 프로젝트 양쪽에서 실행된다(playwright.config.ts).
 */
test.describe('판단 로그 - 안건 작성과 합의 기록', () => {
  test('안건 작성 → 의견 등록 → 합의 확정 → 재조회까지 완결된 흐름으로 동작한다', async ({
    page,
  }) => {
    await page.goto('judgment-log')
    await loginAsMockUser(page)

    await page.getByRole('button', { name: '안건 작성' }).click() // 작성 폼 열기
    await page.getByLabel('제목').fill('배당주 비중 조정 논의')
    await page.getByLabel('내용').fill('배당주 비중을 늘리는 방안에 대해 논의해보자.')
    const composeForm = page.locator('form')
    await composeForm.getByRole('button', { name: '안건 작성' }).click()

    const newAgendaButton = page.getByRole('button', { name: /배당주 비중 조정 논의/ })
    await expect(newAgendaButton).toBeVisible()
    await newAgendaButton.click()

    await page.getByLabel('의견 작성').fill('좋은 의견이야, 진행하자')
    await page.getByRole('button', { name: '의견 등록' }).click()
    await expect(page.getByText('좋은 의견이야, 진행하자')).toBeVisible()

    await page.getByRole('button', { name: '합의 확정' }).click()
    await expect(page.getByText('합의완료', { exact: true }).first()).toBeVisible()
  })

  test('의견 0건 상태에서도 합의를 확정할 수 있다(FR-019)', async ({ page }) => {
    await page.goto('judgment-log')
    await loginAsMockUser(page)

    await page.getByRole('button', { name: '안건 작성' }).click() // 작성 폼 열기
    await page.getByLabel('제목').fill('의견 없이 바로 확정')
    await page.getByLabel('내용').fill('별다른 이견이 없어 바로 확정하는 안건이다.')
    const composeForm = page.locator('form')
    await composeForm.getByRole('button', { name: '안건 작성' }).click()

    await page.getByRole('button', { name: /의견 없이 바로 확정/ }).click()
    const confirmButton = page.getByRole('button', { name: '합의 확정' })
    await expect(confirmButton).toBeEnabled()
    await confirmButton.click()

    await expect(page.getByText('합의완료', { exact: true }).first()).toBeVisible()
  })

  test('논의중 안건은 작성자 본인만 수정 폼을 볼 수 있다(FR-016a)', async ({ page }) => {
    await page.goto('judgment-log')
    await loginAsMockUser(page)

    await page.getByRole('button', { name: /비상금 파킹통장 추가 증액/ }).click() // 상대방 작성(논의중)
    await expect(page.getByRole('button', { name: '수정 저장' })).toHaveCount(0)

    await page.getByRole('button', { name: /연금저축계좌 미국 인덱스 펀드 비중 확대/ }).click() // 본인 작성(논의중)
    await expect(page.getByRole('button', { name: '수정 저장' })).toBeVisible()
  })

  test('합의완료 안건은 사유와 함께 수정하고 이전 내용이 변경 이력으로 남는다(FR-021)', async ({
    page,
  }) => {
    await page.goto('judgment-log')
    await loginAsMockUser(page)

    await page.getByRole('button', { name: /해외주식 양도소득세 분할 기본공제 활용 매도 건/ }).click() // 합의완료
    await page.getByRole('button', { name: '합의 내용 수정' }).click()

    await page.getByLabel('제목').fill('해외주식 양도세 기본공제 활용 매도 건(금액 정정)')
    await page.getByRole('button', { name: '이력 남기고 수정' }).click()
    await expect(page.getByRole('alert')).toBeVisible() // 사유가 없으면 저장하지 않는다

    await page.getByLabel('수정 사유').fill('매도 금액 오기 정정')
    await page.getByRole('button', { name: '이력 남기고 수정' }).click()

    await expect(page.getByRole('heading', { name: '변경 이력' })).toBeVisible()
    await expect(page.getByText('사유: 매도 금액 오기 정정')).toBeVisible()
    await expect(
      page.getByRole('heading', { name: '해외주식 양도세 기본공제 활용 매도 건(금액 정정)' }),
    ).toBeVisible()
  })
})

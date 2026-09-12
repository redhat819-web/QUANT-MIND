import { expect, test } from '@playwright/test'

/**
 * User Story 1 Given-When-Then 시나리오(spec.md Acceptance Scenarios 1-8).
 * 데스크톱/모바일 프로젝트 양쪽에서 실행된다(playwright.config.ts).
 */
test.describe('대시보드 - 통합 자산 현황과 비중 확인', () => {
  test('로그인 후 개인/부부 통합, 비중, 안건 요약, 기준 시점이 모두 표시된다', async ({
    page,
  }) => {
    await page.goto('/dashboard')

    await expect(page.getByRole('button', { name: '로그인 (Mock)' })).toBeVisible()
    await page.getByRole('button', { name: '로그인 (Mock)' }).click()

    await expect(page.getByText('나')).toBeVisible()
    await expect(page.getByText('상대방')).toBeVisible()
    await expect(page.getByText('부부 합계')).toBeVisible()
    await expect(page.getByText('참고용 — 투자 권유 아님')).toBeVisible()
    await expect(page.getByText(/기준 시점:/)).toBeVisible()
    await expect(page.getByText('성장', { exact: true })).toBeVisible()
    await expect(page.getByText('방어', { exact: true })).toBeVisible()
    await expect(page.getByText('현금', { exact: true })).toBeVisible()
  })

  test('로그인하지 않으면 로그인 안내로 이동하고 자산 데이터는 표시되지 않는다', async ({
    page,
  }) => {
    await page.goto('/dashboard')
    await expect(page.getByText('권한 없음')).toBeVisible()
    await expect(page.getByText('부부 합계')).toHaveCount(0)
  })
})

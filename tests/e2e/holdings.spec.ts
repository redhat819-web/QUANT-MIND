import { expect, test } from '@playwright/test'

/**
 * User Story 2 Given-When-Then 시나리오(spec.md Acceptance Scenarios).
 * 데스크톱/모바일 프로젝트 양쪽에서 실행된다(playwright.config.ts).
 */
test.describe('계좌·종목 리스트 - 상세 조회와 분류 수정', () => {
  test('빠른 확인 모드 → 상세 모드 → 분류 변경까지 완결된 흐름으로 동작한다', async ({
    page,
  }) => {
    await page.goto('/holdings')
    await page.getByRole('button', { name: '로그인 (Mock)' }).click()

    await expect(page.getByText('나의 증권계좌 A')).toBeVisible()
    await expect(page.getByText('상대방 증권계좌 A')).toBeVisible()
    await expect(page.getByText('종목 상세')).toHaveCount(0)

    await page.getByRole('button', { name: '상세 모드' }).click()
    await expect(page.getByText('삼성전자')).toBeVisible()
    await expect(page.getByText('데이터 없음').first()).toBeVisible()

    const classificationSelect = page.getByLabel('hold-1 분류')
    await classificationSelect.selectOption('defensive')
    await expect(classificationSelect).toHaveValue('defensive')
  })

  test('미매핑 종목은 원본 표기와 함께 배지로 노출된다', async ({ page }) => {
    await page.goto('/holdings')
    await page.getByRole('button', { name: '로그인 (Mock)' }).click()

    await page.getByRole('button', { name: '상세 모드' }).click()
    await page.getByRole('button', { name: '상대방 증권계좌 A' }).click()

    await expect(page.getByText('미매핑', { exact: true })).toBeVisible()
    await expect(page.getByText(/APPLE INC/)).toBeVisible()
  })
})

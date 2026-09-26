import { expect, type Page } from '@playwright/test'

export async function loginAsMockUser(page: Page) {
  const emailInput = page.getByLabel('이메일')
  await expect(emailInput).toBeVisible()

  await emailInput.fill('e2e@example.test')
  await page.getByLabel('비밀번호').fill('mock-pass')
  await page.getByRole('button', { name: '로그인', exact: true }).click()

  await expect(emailInput).toBeHidden()
}

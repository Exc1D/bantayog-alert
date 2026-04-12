import { test, expect } from '@playwright/test'
import { checkA11y } from './a11y.config'

test.describe('Profile Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/profile')
  })

  test('should have no a11y violations on anonymous profile', async ({ page }) => {
    await checkA11y(page, 'anonymous profile')
  })

  test('should have accessible create account CTA', async ({ page }) => {
    const ctaButton = page.getByRole('button', { name: /create account/i })
    await expect(ctaButton).toBeVisible()
    await expect(ctaButton).toHaveAttribute('type', 'button')
  })

  test('should list account benefits accessibly', async ({ page }) => {
    const benefitsList = page.locator('ul[aria-label*="benefit" i]')
    await expect(benefitsList).toBeVisible()

    const items = benefitsList.locator('li').all()
    expect(await items.count()).toBeGreaterThan(0)
  })
})
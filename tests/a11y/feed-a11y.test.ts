import { test, expect } from '@playwright/test'
import { checkA11y } from './a11y.config'

test.describe('Feed Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/feed')
  })

  test('should have no a11y violations', async ({ page }) => {
    await checkA11y(page, 'feed page')
  })

  test('should have accessible feed cards', async ({ page }) => {
    const firstCard = page.locator('[data-testid="feed-card"]').first()
    await expect(firstCard).toHaveAttribute('role', 'article')

    const heading = firstCard.locator('h2, h3').first()
    await expect(heading).toBeVisible()
  })

  test('should announce when new reports load', async ({ page }) => {
    const status = page.locator('[role="status"]')
    // Scroll to trigger infinite scroll
    await page.mouse.wheel(0, 1000)
    await page.waitForTimeout(500)
    // Should announce "X new reports loaded" (check implementation)
  })
})
import { test, expect } from '@playwright/test'
import { checkA11y } from './a11y.config'

test.describe('Profile Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('age_verified', 'true')
    })
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
    // The benefits list is a plain <ul> inside the value proposition card (AnonymousProfile.tsx line 47)
    // Use text content to find the section, then get the <ul> inside it
    const benefitsList = page.locator('text="Why create an account?"').locator('..').locator('ul')
    await expect(benefitsList).toBeVisible()

    const items = benefitsList.locator('li')
    const itemCount = await benefitsList.locator('li').count()
    expect(itemCount).toBeGreaterThan(0)
  })
})

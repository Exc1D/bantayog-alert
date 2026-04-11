import { test, expect } from '@playwright/test'
import { checkA11y } from './a11y.config'

test.describe('Report Form Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    // Bypass age gate - set localStorage before any navigation
    await page.addInitScript(() => {
      localStorage.setItem('age_verified', 'true')
    })
    await page.goto('/report')
  })

  test('should have no a11y violations', async ({ page }) => {
    await checkA11y(page, 'report form')
  })

  test('should have accessible form fields', async ({ page }) => {
    // All inputs should have associated labels
    const inputs = page.locator('input, textarea, select').all()
    for (const input of await inputs) {
      const id = await input.getAttribute('id')
      if (id) {
        const label = page.locator(`label[for="${id}"]`)
        await expect(label).toBeVisible()
      }
    }
  })

  test('should announce form errors to screen readers', async ({ page }) => {
    const submitButton = page.getByRole('button', { name: /submit/i })
    await submitButton.click()

    const errors = page.locator('[role="alert"]')
    await expect(errors.first()).toBeVisible()
  })

  test('should be keyboard navigable', async ({ page }) => {
    // Focus order: incident type -> description -> phone -> photo
    // Note: We verify focus order by checking the focused element's id matches expected field id
    // after each Tab press. This requires the form to be fully rendered.
    const fieldIds = ['report-incident-type', 'report-description', 'report-phone']

    // Click on the first field to establish focus
    const firstField = page.locator('#report-incident-type')
    await firstField.click()

    for (const fieldId of fieldIds) {
      await page.keyboard.press('Tab')
      const focused = page.locator(':focus')
      await expect(focused).toHaveAttribute('id', fieldId)
    }
  })
})
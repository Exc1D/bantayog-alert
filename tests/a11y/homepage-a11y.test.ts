/**
 * Homepage Accessibility Tests
 *
 * Tests WCAG 2.1 AA compliance for the homepage including:
 * - Color contrast
 * - Keyboard navigation
 * - ARIA labels
 * - Focus management
 *
 * Run: npx playwright test tests/a11y/homepage-a11y.test.ts
 */

import { test, expect } from '@playwright/test'
import { checkA11y } from './a11y.config'

test.describe('Homepage Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should have no accessibility violations on load', async ({ page }) => {
    await checkA11y(page, 'homepage')
  })

  test('should have accessible navigation', async ({ page }) => {
    // Check all nav links are accessible
    const navLinks = page.locator('nav a').all()
    for (const link of await navLinks) {
      await expect(link).toHaveAttribute('href')
      const text = await link.textContent()
      expect(text?.trim()).toBeTruthy() // Non-empty text
    }
  })

  test('should be keyboard navigable', async ({ page }) => {
    // Tab through page - verify focus moves to an interactive element
    await page.keyboard.press('Tab')
    await page.waitForTimeout(100)

    // Verify focus landed on an actual interactive element
    const focusedElement = page.locator(':focus')
    await expect(focusedElement).toBeVisible()
  })

  test('should have color contrast >= 4.5:1', async ({ page }) => {
    // This is checked automatically by axe-core
    await checkA11y(page, 'homepage color contrast')
  })
})

import { test, expect } from '@playwright/test'
import { checkA11y } from './a11y.config'

test.describe('Map Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/map')
  })

  test('should have no a11y violations', async ({ page }) => {
    await checkA11y(page, 'map page')
  })

  test('should have accessible map pins', async ({ page }) => {
    const pins = await page.locator('[data-testid^="map-pin"]').all()
    for (const pin of pins.slice(0, 3)) { // Check first 3
      await expect(pin).toHaveAttribute('aria-label')
      const label = await pin.getAttribute('aria-label')
      expect(label).toMatch(/(Flood|Earthquake|Landslide|Fire)/)
    }
  })

  test('should announce filter changes to screen readers', async ({ page }) => {
    const filterButton = page.getByRole('button', { name: /filter/i })
    await filterButton.click()

    const status = page.locator('[role="status"]')
    await expect(status).toBeVisible()
  })
})
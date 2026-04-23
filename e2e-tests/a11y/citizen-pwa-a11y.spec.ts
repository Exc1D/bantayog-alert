import { test } from '@playwright/test'

test.describe('Citizen PWA accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should be keyboard navigable', async ({ page }) => {
    await page.keyboard.press('Tab')
  })
})

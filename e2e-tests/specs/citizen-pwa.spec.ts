import { test, expect } from '@playwright/test'

test.describe('Citizen PWA submission flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')

    await page.evaluate(() => {
      localStorage.clear()
    })
  })

  test('should complete full submission on real device', async ({ page }) => {
    await page.click('button:has-text("Flood")')

    await page.click('button:has-text("Capture location")')

    await page.waitForTimeout(1000)

    await page.fill('input[placeholder*="Maria"]', 'Maria Dela Cruz')
    await page.fill('input[placeholder*="+63"]', '+63 912 345 6789')

    await page.click('button:has-text("Yes")')
    await page.click('button:has-text("+")')

    await page.waitForSelector('text=We heard you. We are here.')

    const consent = page.locator('input[type="checkbox"]').first()
    await consent.check()

    await page.click('button:has-text("Submit report")')

    await expect(page.locator('text=We heard you. We are here.')).toBeVisible()
    await expect(page.locator('text=BA-')).toBeVisible()
  })

  test.skip('should handle offline state and retry', async () => {
    // TODO: Simulate offline mode, queue submission, retry on reconnect
  })

  test.skip('should track report updates in real-time', async () => {
    // TODO: Navigate to tracking, simulate admin status update via Firebase Emulator
  })
})

test.describe('Reveal sheet back button guard', () => {
  test.skip('should block back on queued state', async () => {
    // TODO: Trigger submission that goes to queued, test back button guard
  })
})

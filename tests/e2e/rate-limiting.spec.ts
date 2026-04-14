import { test, expect } from '@playwright/test'

test.describe('Rate Limiting', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('age_verified', 'true')
    })
    await page.goto('/report')
  })

  test('should allow 1 report per hour per device', async ({ page }) => {
    // Submit first report
    await fillValidReport(page)
    await page.getByRole('button', { name: /submit/i }).click()

    // Should see success
    await expect(page.getByText(/report submitted/i)).toBeVisible()

    // Navigate back and try to submit second report immediately
    await page.goto('/report')
    await fillValidReport(page)
    await page.getByRole('button', { name: /submit/i }).click()

    // Should see rate limit error
    await expect(page.getByText(/rate limit|too many reports/i)).toBeVisible()
  })

  test('should show rate limit exceeded UI', async ({ page }) => {
    // Use localStorage to simulate rate limit state
    // This tests the UI's response to the rate limit flag, not the actual rate limiting logic
    await page.evaluate(() => {
      localStorage.setItem('reportsLastHour', '3')
      localStorage.setItem('reportsLastHourTimestamp', String(Date.now()))
    })

    await page.goto('/report')

    // The app should read from localStorage and show rate limit UI
    // Note: This tests UI behavior only - actual rate limiting requires backend validation
    const rateLimitVisible = await page
      .getByText(/rate limit/i)
      .isVisible()
      .catch(() => false)
    if (!rateLimitVisible) {
      // Fallback: Check if form is blocked
      await expect(page.getByRole('button', { name: /submit/i })).toBeDisabled()
    } else {
      await expect(page.getByText(/rate limit/i)).toBeVisible()
    }
  })

  test('should allow 3 reports per day per device', async ({ page }) => {
    // Submit 3 reports (should work)
    for (let i = 0; i < 3; i++) {
      await page.goto('/report')
      await fillValidReport(page)
      await page.getByRole('button', { name: /submit/i }).click()
      await expect(page.getByText(/report submitted/i)).toBeVisible()
    }

    // 4th report should be rate limited
    await page.goto('/report')
    await fillValidReport(page)
    await page.getByRole('button', { name: /submit/i }).click()
    await expect(page.getByText(/rate limit|daily limit/i)).toBeVisible()
  })

  test('should track rate limit by phone number', async ({ page, context }) => {
    const phoneNumber = '09123456789'

    // Submit first report with phone
    await page.goto('/report')
    await page.getByLabel(/phone/i).fill(phoneNumber)
    await fillValidReport(page, { skipPhone: true })
    await page.getByRole('button', { name: /submit/i }).click()

    // Simulate different device by clearing localStorage (not cookies)
    // Cookies don't affect phone-based rate limiting
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })

    // New session with same phone should still be rate limited
    await page.goto('/report')
    await page.getByLabel(/phone/i).fill(phoneNumber)
    await fillValidReport(page, { skipPhone: true })
    await page.getByRole('button', { name: /submit/i }).click()

    // Should be rate limited by phone (actual implementation depends on backend)
    // This test documents the expected behavior: phone-based tracking across devices
    const rateLimited = await page
      .getByText(/rate limit/i)
      .isVisible()
      .catch(() => false)
    expect(rateLimited).toBeTruthy()
  })
})

// Helper function
async function fillValidReport(page, options = {}) {
  const { skipPhone = false } = options

  // Select incident type
  await page.getByRole('combobox', { name: /incident/i }).selectOption('flood')

  // Add photo (required field)
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles({ name: 'test-photo.jpg', mimeType: 'image/jpeg' } as any)

  // Add phone
  if (!skipPhone) {
    await page.getByLabel(/phone/i).fill('09123456789')
  }

  // Agree to terms
  await page.getByRole('checkbox', { name: /agree/i }).check()
}

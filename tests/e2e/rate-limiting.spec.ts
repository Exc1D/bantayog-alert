import { test, expect } from '@playwright/test'

test.describe('Rate Limiting', () => {
  test.beforeEach(async ({ page }) => {
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
    // Try to submit when rate limited
    await page.evaluate(() => {
      // Simulate being rate limited
      sessionStorage.setItem('reportsLastHour', '3')
    })

    await page.goto('/report')
    await expect(page.getByText(/rate limit/i)).toBeVisible()
  })

  test('should allow 3 reports per day per device', async ({ page, context }) => {
    const reports = []

    // Submit 3 reports (should work)
    for (let i = 0; i < 3; i++) {
      await page.goto('/report')
      await fillValidReport(page)
      await page.getByRole('button', { name: /submit/i }).click()
      await expect(page.getByText(/report submitted/i)).toBeVisible()
      reports.push(i)
    }

    // 4th report should be rate limited
    await page.goto('/report')
    await fillValidReport(page)
    await page.getByRole('button', { name: /submit/i }).click()
    await expect(page.getByText(/rate limit|daily limit/i)).toBeVisible()
  })

  test('should track rate limit by phone number', async ({ page }) => {
    const phoneNumber = '09123456789'

    // Submit report with phone
    await page.goto('/report')
    await page.getByLabel(/phone/i).fill(phoneNumber)
    await fillValidReport(page, { skipPhone: true })
    await page.getByRole('button', { name: /submit/i }).click()

    // Try different device with same phone (simulate by clearing storage)
    await context.clearCookies()
    await page.goto('/report')
    await page.getByLabel(/phone/i).fill(phoneNumber)
    await fillValidReport(page, { skipPhone: true })
    await page.getByRole('button', { name: /submit/i }).click()

    // Should still be rate limited by phone
    await expect(page.getByText(/rate limit/i)).toBeVisible()
  })
})

// Helper function
async function fillValidReport(page, options = {}) {
  const { skipPhone = false } = options

  // Select incident type
  await page.getByRole('combobox', { name: /incident/i }).selectOption('flood')

  // Add description
  await page.getByLabel(/description/i).fill('Test flood report. Water is rising.')

  // Add phone
  if (!skipPhone) {
    await page.getByLabel(/phone/i).fill('09123456789')
  }

  // Agree to terms
  await page.getByRole('checkbox', { name: /agree/i }).check()
}

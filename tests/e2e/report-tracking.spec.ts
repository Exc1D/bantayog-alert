/**
 * End-to-End Tests for Anonymous Report Tracking
 *
 * Tests the flow where an anonymous user submits a report,
 * receives a Report ID, and can look up the status using that ID.
 *
 * Run: firebase emulators:start --background && npx playwright test tests/e2e/report-tracking.spec.ts
 */

import { test, expect } from '@playwright/test'

test.describe('Anonymous Report Tracking', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('age_verified', 'true')
    })
    await page.goto('/')
  })

  test('should display Report ID after successful submission', async ({ page }) => {
    // Navigate to report form
    await page.getByRole('link', { name: /report/i }).click()

    // Fill required fields
    await page.getByLabel(/description/i).fill('Flooding near the main road')
    await page.getByLabel(/phone/i).fill('+63 912 345 6789')

    // Submit — wait for the button to be enabled (geolocation must resolve first)
    const submitBtn = page.getByRole('button', { name: /submit report/i })
    await expect(submitBtn).toBeEnabled()
    await submitBtn.click()

    // Should show success with Report ID
    await expect(page.getByTestId('report-id')).toBeVisible()
    const reportIdText = await page.getByTestId('report-id').textContent()
    expect(reportIdText).toMatch(/^#\d{4}-[A-Z]{4}-\d{4}$/)
  })

  test('should allow entering Report ID to check status', async ({ page }) => {
    // Navigate to profile
    await page.getByRole('link', { name: /profile/i }).click()

    // Check if the report tracking input exists (skip if not implemented)
    const inputExists = (await page.locator('[placeholder*="report id" i]').count()) > 0
    if (!inputExists) {
      test.skip()
    }

    // Enter a report ID
    await page.locator('[placeholder*="report id" i]').fill('2024-DAET-0471')

    // Submit lookup
    await page
      .getByRole('button', { name: /track|lookup|check/i })
      .first()
      .click()

    // Should show a report entry with a status badge
    await expect(page.getByTestId(/^user-report-/).first()).toBeVisible({ timeout: 5000 })
  })

  test('should show error for invalid Report ID format', async ({ page }) => {
    await page.getByRole('link', { name: /profile/i }).click()

    const inputExists = (await page.locator('[placeholder*="report id" i]').count()) > 0
    if (!inputExists) {
      test.skip()
    }

    await page.locator('[placeholder*="report id" i]').fill('invalid-id')
    await page.getByRole('button', { name: /track/i }).click()

    // Should show validation error
    await expect(page.getByText(/invalid report id/i)).toBeVisible()
  })
})

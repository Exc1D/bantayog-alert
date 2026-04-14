/**
 * End-to-End Tests for Report Submission
 *
 * Tests the citizen report submission flow from navigation to success confirmation.
 * Requires: dev server + Firebase emulators running
 *
 * Run: firebase emulators:start --background && npx playwright test tests/e2e/report-submission.spec.ts
 */

import { test, expect } from '@playwright/test'

test.describe('Report Submission', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('age_verified', 'true')
    })
    await page.goto('/')
  })

  test('should submit an anonymous report with description and phone number', async ({ page }) => {
    // Navigate to the report form via the bottom nav tab
    await page.getByRole('link', { name: /report/i }).click()

    // Confirm the form is visible before interacting
    const descriptionField = page.getByLabel(/description/i)
    await expect(descriptionField).toBeVisible()

    // Fill in the description
    await descriptionField.fill('Flooding along the main road near the market')

    // Fill in the optional contact phone number
    const phoneField = page.getByLabel(/phone/i)
    await phoneField.fill('+63 912 345 6789')

    // Submit — photo is optional, skip it
    await page.getByRole('button', { name: /submit report/i }).click()

    // Expect the success confirmation screen
    await expect(page.getByText(/report submitted/i)).toBeVisible()
  })

  test('should show manual location dropdowns when GPS is denied', async ({ page }) => {
    // Revoke all permissions so the browser returns a GeolocationPositionError
    // with code PERMISSION_DENIED when the form tries to acquire the user's position
    await page.context().clearPermissions()

    // Navigate to the report form
    await page.getByRole('link', { name: /report/i }).click()

    // When GPS is unavailable the form must fall back to manual municipality selection
    await expect(page.getByText('Select Municipality')).toBeVisible()
  })
})

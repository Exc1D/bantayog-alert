/**
 * End-to-End Tests for Full Citizen Journey
 *
 * Tests complete user flows from anonymous browsing through report submission
 * and account creation. These tests require Firebase Emulator and Playwright to run.
 *
 * Run: firebase emulators:start --background && npx playwright test tests/e2e/citizen-journey.spec.ts
 */

import { test, expect } from '@playwright/test'

test.describe('Anonymous Citizen Journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('age_verified', 'true')
    })
    await page.goto('/')
  })

  test('should browse app without account', async ({ page }) => {
    // Should land on Map view by default
    await expect(page).toHaveURL(/\/$|map/)

    // Should see bottom navigation
    await expect(page.getByRole('link', { name: /map/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /feed/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /report/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /alerts/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /profile/i })).toBeVisible()

    // Should not see logged-in indicators
    await expect(page.getByText(/welcome/i)).not.toBeVisible()
  })

  test('should navigate between all tabs', async ({ page }) => {
    // Navigate to Feed
    await page.getByRole('link', { name: /feed/i }).click()
    await expect(page).toHaveURL(/feed/)
    await expect(page.getByRole('heading', { name: /feed/i })).toBeVisible()

    // Navigate to Alerts
    await page.getByRole('link', { name: /alerts/i }).click()
    await expect(page).toHaveURL(/alerts/)
    await expect(page.getByRole('heading', { name: /alerts/i })).toBeVisible()

    // Navigate to Profile
    await page.getByRole('link', { name: /profile/i }).click()
    await expect(page).toHaveURL(/profile/)

    // Navigate back to Map
    await page.getByRole('link', { name: /map/i }).click()
    await expect(page).toHaveURL(/\/$|map/)
  })

  test('should submit report without creating account', async ({ page }) => {
    // Navigate to Report
    await page.getByRole('link', { name: /report/i }).click()

    // Fill in required fields
    await page.getByLabel(/description/i).fill('Water supply contamination in Zone 3')

    // Submit without photos or contact info
    await page.getByRole('button', { name: /submit report/i }).click()

    // Should see success confirmation
    await expect(page.getByText(/report submitted/i)).toBeVisible()

    // Should not prompt for account creation yet
    // (only on subsequent visits or via explicit prompt)
  })

  test('should see create account option after first report', async ({ page }) => {
    // Submit first report
    await page.getByRole('link', { name: /report/i }).click()
    await page.getByLabel(/description/i).fill('First report')
    await page.getByRole('button', { name: /submit report/i }).click()

    // Should see option to create account for tracking
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible()
    await expect(page.getByText(/track updates/i)).toBeVisible()
  })

  test('should return to feed after report submission', async ({ page }) => {
    // Submit report
    await page.getByRole('link', { name: /report/i }).click()
    await page.getByLabel(/description/i).fill('Damaged road sign')
    await page.getByRole('button', { name: /submit report/i }).click()

    // Return to feed via navigation button
    await page.getByRole('button', { name: /return to feed/i }).click()

    await expect(page).toHaveURL(/feed/)
  })
})

test.describe('Feed Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('age_verified', 'true')
    })
    await page.goto('/feed')
  })

  test('should display list of verified reports', async ({ page }) => {
    // Should show report cards
    const reportCards = page.locator('[data-testid^="report-card"]')
    await expect(reportCards.first()).toBeVisible({ timeout: 10000 })
  })

  test('should filter reports by municipality', async ({ page }) => {
    // Look for municipality filter
    const filterButton = page.getByRole('button', { name: /filter/i })
    if (await filterButton.isVisible()) {
      await filterButton.click()

      // Select a municipality
      await page.getByRole('option', { name: /daet/i }).click()

      // Wait for filter to apply
      await page.waitForTimeout(500)
    }
  })

  test('should show time range filter options', async ({ page }) => {
    // Look for time filter
    const timeFilter = page.getByRole('button', { name: /time range/i })
    if (await timeFilter.isVisible()) {
      await timeFilter.click()

      // Should show time options
      await expect(page.getByText(/last hour/i)).toBeVisible()
      await expect(page.getByText(/last 24 hours/i)).toBeVisible()
      await expect(page.getByText(/last 7 days/i)).toBeVisible()
    }
  })

  test('should tap report to view details', async ({ page }) => {
    // Wait for reports to load
    const firstReport = page.locator('[data-testid^="report-card"]').first()
    await firstReport.waitFor({ state: 'visible', timeout: 10000 })

    // Click on the first report
    await firstReport.click()

    // Should navigate to report detail
    await expect(page).toHaveURL(/\/feed\/.+/)
    await expect(page.getByRole('heading', { name: /report details/i })).toBeVisible()
  })
})

test.describe('Account Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('age_verified', 'true')
    })
    await page.goto('/')
    await page.getByRole('link', { name: /profile/i }).click()
  })

  test('should show registration option on profile', async ({ page }) => {
    // Should see create account button for anonymous users
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible()
  })

  test('should navigate to registration from profile', async ({ page }) => {
    await page.getByRole('button', { name: /create account/i }).click()

    // Should navigate to registration
    await expect(page).toHaveURL(/register/)
    await expect(page.getByRole('heading', { name: /register/i })).toBeVisible()
  })

  test('should register as citizen and stay logged in', async ({ page }) => {
    // Navigate to registration
    await page.getByRole('button', { name: /create account/i }).click()
    await page.selectOption('select[name="role"]', 'citizen')

    // Fill registration form
    await page.fill('input[name="email"]', 'newcitizen@example.com')
    await page.fill('input[name="password"]', 'SecurePass123!')
    await page.fill('input[name="displayName"]', 'New Citizen')

    // Submit
    await page.click('button[type="submit"]')

    // Should see success and be on dashboard
    await expect(page.getByText(/registration successful/i)).toBeVisible()

    // Should show logged-in state on profile
    await page.goto('/profile')
    await expect(page.getByText(/welcome/i)).toBeVisible()
  })
})

test.describe('Push Notifications', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('age_verified', 'true')
    })
    await page.goto('/')
  })

  test('should prompt for notifications after first report', async ({ page }) => {
    // Submit first report
    await page.getByRole('link', { name: /report/i }).click()
    await page.getByLabel(/description/i).fill('Notification test')
    await page.getByRole('button', { name: /submit report/i }).click()

    // Should show notification prompt for first report
    await expect(page.getByTestId('notification-prompt')).toBeVisible()
    await expect(page.getByText(/get notified/i)).toBeVisible()
  })

  test('should enable notifications when prompted', async ({ page }) => {
    // Grant notification permission
    await page.context().grantPermissions(['notifications'])

    // Submit first report
    await page.getByRole('link', { name: /report/i }).click()
    await page.getByLabel(/description/i).fill('Enable notifications test')
    await page.getByRole('button', { name: /submit report/i }).click()

    // Click enable notifications button
    const enableButton = page.getByTestId('enable-notifications-button')
    if (await enableButton.isVisible()) {
      await enableButton.click()
    }
  })
})

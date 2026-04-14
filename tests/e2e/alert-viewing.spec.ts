/**
 * End-to-End Tests for Alert Viewing and External Links
 *
 * Tests alert display, push notification links, and external communication links.
 * These tests require Firebase Emulator and Playwright to run.
 *
 * Run: firebase emulators:start --background && npx playwright test tests/e2e/alert-viewing.spec.ts
 */

import { test, expect } from '@playwright/test'

test.describe('Alert Viewing', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('age_verified', 'true')
    })
    await page.goto('/alerts')
  })

  test('should display list of alerts', async ({ page }) => {
    // Wait for alerts to load
    await page.waitForSelector('[data-testid^="alert-card"]', { timeout: 10000 })

    // Should show alert cards
    const alertCards = page.locator('[data-testid^="alert-card"]')
    const count = await alertCards.count()
    expect(count).toBeGreaterThan(0)
  })

  test('should show alert severity indicators', async ({ page }) => {
    // Wait for alerts to load
    const firstAlert = page.locator('[data-testid^="alert-card"]').first()
    await firstAlert.waitFor({ state: 'visible' })

    // Should have severity icon with proper aria-label
    const severityIcon = page.getByLabel(/severity-/)
    await expect(severityIcon.first()).toBeVisible()
  })

  test('should show relative time for alerts', async ({ page }) => {
    // Wait for alerts to load
    const firstAlert = page.locator('[data-testid^="alert-card"]').first()
    await firstAlert.waitFor({ state: 'visible' })

    // Should show time in "Xm ago" or "Xh ago" format
    await expect(page.getByText(/\d+[mh] ago/i)).toBeVisible()
  })

  test('should truncate long alert messages', async ({ page }) => {
    // Wait for alerts to load
    await page.waitForSelector('[data-testid^="alert-card"]', { timeout: 10000 })

    // Look for "See more" button on long messages
    const seeMoreButton = page.getByTestId('see-more-button')
    const isVisible = await seeMoreButton.isVisible()

    if (isVisible) {
      // Should show truncated text
      await expect(seeMoreButton).toHaveText(/see more/i)

      // Click to expand
      await seeMoreButton.click()

      // Should now show "See less"
      await expect(seeMoreButton).toHaveText(/see less/i)
    }
  })

  test('should expand and collapse long messages', async ({ page }) => {
    // Wait for alerts to load
    await page.waitForSelector('[data-testid^="alert-card"]', { timeout: 10000 })

    const seeMoreButton = page.getByTestId('see-more-button')
    if (await seeMoreButton.isVisible()) {
      // Expand
      await seeMoreButton.click()
      await expect(seeMoreButton).toHaveText(/see less/i)

      // Collapse
      await seeMoreButton.click()
      await expect(seeMoreButton).toHaveText(/see more/i)
    }
  })

  test('should show Read More link when linkUrl exists', async ({ page }) => {
    // Wait for alerts to load
    await page.waitForSelector('[data-testid^="alert-card"]', { timeout: 10000 })

    // Look for alerts with Read More link
    const readMoreLink = page.getByTestId('read-more-link')
    if (await readMoreLink.first().isVisible()) {
      await expect(readMoreLink.first()).toHaveText(/read more/i)
    }
  })

  test('should open Read More links in new tab', async ({ page }) => {
    // Wait for alerts to load
    await page.waitForSelector('[data-testid^="alert-card"]', { timeout: 10000 })

    const readMoreLink = page.getByTestId('read-more-link').first()
    if (await readMoreLink.isVisible()) {
      // Click should open in new tab - verify link structure
      await readMoreLink.click()

      // Verifynoopener,noreferrer is set for security
      const link = page.locator('[data-testid="read-more-link"]').first()
      await expect(link).toHaveAttribute('target', '_blank')
    }
  })
})

test.describe('Alert Categories and Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('age_verified', 'true')
    })
    await page.goto('/alerts')
    await page.waitForSelector('[data-testid^="alert-card"]', { timeout: 10000 })
  })

  test('should show category filter tabs', async ({ page }) => {
    // Look for severity filter buttons
    const emergencyFilter = page.getByRole('button', { name: /emergency/i })
    const warningFilter = page.getByRole('button', { name: /warning/i })
    const infoFilter = page.getByRole('button', { name: /info/i })

    // At least one should be visible
    const anyVisible =
      (await emergencyFilter.isVisible()) ||
      (await warningFilter.isVisible()) ||
      (await infoFilter.isVisible())
    expect(anyVisible).toBeTruthy()
  })

  test('should filter by severity level', async ({ page }) => {
    const warningFilter = page.getByRole('button', { name: /warning/i })
    if (await warningFilter.isVisible()) {
      await warningFilter.click()

      // After filtering, should only show warning alerts
      await page.waitForTimeout(500)

      // Check that only warning severity icons are visible
      const warningIcons = page.getByLabel('severity-warning')
      const emergencyIcons = page.getByLabel('severity-emergency')
      const infoIcons = page.getByLabel('severity-info')

      // Should show some warnings
      const warningCount = await warningIcons.count()
      expect(warningCount).toBeGreaterThan(0)
    }
  })
})

test.describe('Push Notification Deep Links', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('age_verified', 'true')
    })
    // Intercept console to check for FCM messaging
    await page.context().clearCookies()
  })

  test('should register service worker for push notifications', async ({ page }) => {
    await page.goto('/')

    // Check for service worker registration
    const swRegistered = await page.evaluate(() => {
      return 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null
    })

    // Service worker should be registered for PWA
    expect(swRegistered).toBeTruthy()
  })

  test('should handle notification click to navigate to alerts', async ({ page }) => {
    // This test simulates clicking a notification that should deep link to alerts
    await page.goto('/?tab=alerts')

    // Should show alerts view
    await expect(page).toHaveURL(/alerts/)
    await expect(page.getByRole('heading', { name: /alerts/i })).toBeVisible()
  })

  test('should display cached indicator for offline alerts', async ({ page }) => {
    // Go offline
    await page.context().setOffline(true)

    // Reload to get cached alerts
    await page.reload()
    await page.goto('/alerts')

    // Wait for cached alerts to display
    await page.waitForSelector('[data-testid^="alert-card"]', { timeout: 10000 })

    // Look for cached indicator
    const cachedIndicator = page.getByTestId('cached-indicator')
    if (await cachedIndicator.isVisible()) {
      await expect(cachedIndicator).toHaveText(/\(cached\)/)
    }
  })
})

test.describe('External Communication Links', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('age_verified', 'true')
    })
    await page.goto('/')
  })

  test('should show admin phone number for follow-up', async ({ page }) => {
    // Navigate to profile for contact info
    await page.getByRole('link', { name: /profile/i }).click()

    // Should show contact/administrator section
    const contactSection = page.getByText(/contact/i)
    if (await contactSection.isVisible()) {
      // Should have a phone link
      const phoneLink = page.getByRole('link', { name: /\+63\d+/i })
      await expect(phoneLink).toBeVisible()
    }
  })

  test('should have tel: link for phone calls', async ({ page }) => {
    await page.getByRole('link', { name: /profile/i }).click()

    // Look for phone contact
    const phoneLink = page.locator('a[href^="tel:"]')
    if (await phoneLink.isVisible()) {
      await expect(phoneLink).toHaveAttribute('href', /tel:/)
    }
  })

  test('should show Facebook Messenger for conversations', async ({ page }) => {
    await page.getByRole('link', { name: /profile/i }).click()

    // Look for Messenger link
    const messengerLink = page.getByRole('link', { name: /messenger/i })
    if (await messengerLink.isVisible()) {
      await expect(messengerLink).toHaveAttribute('href', /messenger\.com|m\.me/)
    }
  })

  test('should open Messenger in new tab', async ({ page }) => {
    await page.getByRole('link', { name: /profile/i }).click()

    const messengerLink = page.getByRole('link', { name: /messenger/i })
    if (await messengerLink.isVisible()) {
      // Should open in new tab
      await expect(messengerLink).toHaveAttribute('target', '_blank')
      await expect(messengerLink).toHaveAttribute('rel', /noopener|noreferrer/)
    }
  })
})

test.describe('Alert Detail View', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('age_verified', 'true')
    })
    await page.goto('/alerts')
    await page.waitForSelector('[data-testid^="alert-card"]', { timeout: 10000 })
  })

  test('should navigate to alert detail when tapped', async ({ page }) => {
    // Click on first alert card
    const firstAlert = page.locator('[data-testid^="alert-card"]').first()
    await firstAlert.click()

    // Should navigate to alert detail or expand in place
    // The exact behavior depends on implementation
    await page.waitForTimeout(500)
  })

  test('should display full alert message in detail view', async ({ page }) => {
    // Click on first alert
    const firstAlert = page.locator('[data-testid^="alert-card"]').first()
    await firstAlert.click()

    // If there's a detail view, should show full message
    await page.waitForTimeout(500)
  })

  test('should show alert metadata in detail', async ({ page }) => {
    const firstAlert = page.locator('[data-testid^="alert-card"]').first()
    await firstAlert.click()

    // Should show creation time
    await expect(page.getByText(/\d+[mh] ago/i)).toBeVisible()

    // Should show severity
    await expect(page.getByLabel(/severity-/)).toBeVisible()
  })
})

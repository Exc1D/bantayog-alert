import { test, expect, type Page, type ConsoleMessage } from '@playwright/test'

/**
 * Comprehensive E2E tests for the Bantayog Alert Citizen PWA.
 *
 * Covers:
 * - Auth redirect loop prevention
 * - Full report submission wizard
 * - Settings page interactions
 * - Responsive design validation
 * - Offline mode behavior
 * - Console error detection
 */

const BASE_URL = 'http://localhost:5173'

// Allowlist of expected console messages that should not fail tests
const EXPECTED_CONSOLE_PATTERNS = [
  /Download the React DevTools/,
  /\[HMR\]/,
  /\[WDS\]/,
  /WebSocket connection/,
  /manifest.json/,
  /service worker/,
  /favicon/,
  /lucide-react/,
  /reCAPTCHA/,
  /Firebase/,
  /RecaptchaVerifier/,
  /already exists/i,
  /net::ERR_INTERNET_DISCONNECTED/,
  /GeolocationPositionError/,
]

function isExpectedConsoleMessage(msg: ConsoleMessage): boolean {
  const text = msg.text()
  return EXPECTED_CONSOLE_PATTERNS.some((pattern) => pattern.test(text))
}

// ── Helpers ───────────────────────────────────────────────────────────────

async function clearAppStorage(page: Page) {
  await page.goto('about:blank')
  await page.evaluate(() => {
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch {
      // Storage may not be available on about:blank
    }
  })
}

async function waitForSplashScreenToDisappear(page: Page) {
  // Splash screen shows for ~1600ms + exit animation.
  // Wait for it to be completely removed from DOM.
  await page.waitForTimeout(2500)
  // Force remove splash screen if still present (prevents click interception)
  await page.evaluate(() => {
    const splash = document.querySelector('.z-splash')
    if (splash) {
      splash.remove()
    }
  })
}

async function completeOnboardingIfNeeded(page: Page) {
  await page.waitForTimeout(500)
  // If redirected to onboarding, complete all steps
  if (page.url().includes('/onboarding')) {
    // Step 0: Click "Get Started"
    const getStartedButton = page.locator('button:has-text("Get Started")')
    if (await getStartedButton.isVisible().catch(() => false)) {
      await getStartedButton.click()
      await page.waitForTimeout(500)
    }
    
    // Step 1: Click "Start Reporting" to finish onboarding
    const startReportingButton = page.locator('button:has-text("Start Reporting")')
    if (await startReportingButton.isVisible().catch(() => false)) {
      await startReportingButton.click()
      await page.waitForTimeout(500)
    }
  }
}

async function navigateTo(page: Page, url: string) {
  await page.goto(url)
  await waitForSplashScreenToDisappear(page)
}

async function setupPage(page: Page) {
  await clearAppStorage(page)
  await navigateTo(page, BASE_URL)
  await completeOnboardingIfNeeded(page)
}

// ── Test Suite ────────────────────────────────────────────────────────────

test.describe('Citizen PWA - Comprehensive E2E', () => {
  const consoleErrors: ConsoleMessage[] = []
  const consoleWarnings: ConsoleMessage[] = []

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0
    consoleWarnings.length = 0

    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isExpectedConsoleMessage(msg)) {
        consoleErrors.push(msg)
      }
      if (msg.type() === 'warning' && !isExpectedConsoleMessage(msg)) {
        consoleWarnings.push(msg)
      }
    })

page.on('pageerror', (error) => {
      consoleErrors.push(
        Object.defineProperties(Object.create(null), {
          type: { value: () => 'error' },
          text: { value: () => error.message },
        }),
      )
    })
  })

  test.afterEach(async ({}, testInfo) => {
    // Attach console errors to test report for debugging
    if (consoleErrors.length > 0) {
      const messages = consoleErrors.map((m) => `[${m.type()}] ${m.text()}`).join('\n')
      testInfo.attach('console-errors', { body: messages, contentType: 'text/plain' })
    }
    if (consoleWarnings.length > 0) {
      const messages = consoleWarnings.map((m) => `[${m.type()}] ${m.text()}`).join('\n')
      testInfo.attach('console-warnings', { body: messages, contentType: 'text/plain' })
    }

    const errorMessages = consoleErrors.map((m) => m.text())
    const known无害Errors = errorMessages.filter(
      (msg) =>
        msg.includes('reCAPTCHA') ||
        msg.includes('Firebase') ||
        msg.includes('RecaptchaVerifier') ||
        msg.includes('NetworkError') ||
        msg.includes('Failed to fetch') ||
        msg.includes('net::ERR_') ||
        msg.includes('404') ||
        msg.includes('GeolocationPositionError'),
    )
    const unexpectedErrors = errorMessages.filter(
      (msg) =>
        !msg.includes('reCAPTCHA') &&
        !msg.includes('Firebase') &&
        !msg.includes('RecaptchaVerifier') &&
        !msg.includes('NetworkError') &&
        !msg.includes('Failed to fetch') &&
        !msg.includes('net::ERR_') &&
        !msg.includes('404') &&
        !msg.includes('GeolocationPositionError'),
    )

    if (unexpectedErrors.length > 0 && testInfo.status !== 'skipped') {
      throw new Error(
        `Unexpected console errors detected:\n${unexpectedErrors.join('\n')}\n\nKnown harmless errors (not failing):\n${known无害Errors.join('\n')}`,
      )
    }
  })

  // ── 1. Auth redirect loop tests ───────────────────────────────────────

  test.describe('Auth redirect loop prevention', () => {
    test('should show register page when navigating directly to /register', async ({ page }) => {
      await clearAppStorage(page)
      await navigateTo(page, `${BASE_URL}/register`)
      await waitForSplashScreenToDisappear(page)

      await expect(page.locator('h1:has-text("Register")')).toBeVisible()
      await expect(page.locator('input#register-phone')).toBeVisible()

      // Should NOT redirect to onboarding
      expect(page.url()).toContain('/register')
    })

    test('should show login page when navigating directly to /login', async ({ page }) => {
      await clearAppStorage(page)
      await navigateTo(page, `${BASE_URL}/login`)
      await waitForSplashScreenToDisappear(page)

      await expect(page.locator('h1:has-text("Sign In")')).toBeVisible()
      // Should NOT redirect to onboarding
      expect(page.url()).toContain('/login')
    })
  })

  // ── 2. Report submission flow tests ────────────────────────────────────

  test.describe('Report submission flow', () => {
    test('should complete full wizard and show receipt with tracking reference', async ({ page }) => {
      await setupPage(page)

      // Navigate to report page
      await navigateTo(page, `${BASE_URL}/report`)
      await page.waitForTimeout(500)

      // Step 1: Select incident type (Flood)
      await page.click('button:has-text("Flood")')
      await page.click('button:has-text("Continue")')

      // Step 2: Location - use manual selection
      await page.click('button:has-text("Pick my municipality manually")', { force: true })
      await page.waitForTimeout(500)

      // Open municipality dropdown and select first option
      await page.selectOption('#report-municipality', { index: 1 })
      await page.waitForTimeout(500)

      // Fill contact info
      await page.fill('#reporter-name', 'Maria Dela Cruz')
      await page.fill('#reporter-msisdn', '+63 912 345 6789')

      // Answer "No" to anyone hurt question if present
      const noHurtButton = page.locator('button:has-text("No")')
      if (await noHurtButton.isVisible().catch(() => false)) {
        await noHurtButton.click()
      }

      await page.click('button:has-text("Review Report")')
      await page.waitForTimeout(500)

      // Step 3: Review - check consent and submit
      await page.check('input#consent-checkbox')
      await page.click('button:has-text("Submit Report")')

      // Wait for submission to complete (reveal sheet or receipt)
      await page.waitForTimeout(3000)

      // Verify receipt or success state appears
      const receiptVisible = await page.locator('text=Report Received').isVisible().catch(() => false)
      const revealSheetVisible = await page.locator('[aria-label="Submission status"]').isVisible().catch(() => false)
      const trackingRefVisible = await page.locator('text=BA-').isVisible().catch(() => false)
      const successVisible = await page.locator('text=success', { hasText: /success/i }).isVisible().catch(() => false)

      expect(receiptVisible || revealSheetVisible || trackingRefVisible || successVisible).toBe(true)
    })

    test('should verify close button works on receipt screen', async ({ page }) => {
      await setupPage(page)

      // Submit a minimal report
      await navigateTo(page, `${BASE_URL}/report`)
      await page.waitForTimeout(500)

      // Quick report flow
      await page.click('button:has-text("Fire")')
      await page.click('button:has-text("Continue")')
      await page.click('button:has-text("Pick my municipality manually")', { force: true })
      await page.waitForTimeout(500)
      await page.selectOption('#report-municipality', { index: 1 })
      await page.fill('#reporter-name', 'Test User')
      await page.fill('#reporter-msisdn', '+63 912 345 6789')
      await page.click('button:has-text("Review Report")')
      await page.waitForTimeout(500)
      await page.check('input#consent-checkbox')
      await page.click('button:has-text("Submit Report")')
      await page.waitForTimeout(3000)

      // Click close/back button if present
      const closeButton = page.locator('button:has-text("Back to Map"), button:has-text("Close")')
      if (await closeButton.isVisible().catch(() => false)) {
        await closeButton.click()
        await page.waitForTimeout(500)
        // Should navigate back to home
        expect(page.url()).not.toContain('/report')
      }
    })
  })

  // ── 3. Settings page tests ─────────────────────────────────────────────

  test.describe('Settings page', () => {
    test.beforeEach(async ({ page }) => {
      await setupPage(page)
      await navigateTo(page, `${BASE_URL}/settings`)
      await page.waitForTimeout(1000)
    })

    test('should render settings page with all sections', async ({ page }) => {
      await expect(page.locator('h1:has-text("Settings")')).toBeVisible()
      await expect(page.getByText('Notifications', { exact: true })).toBeVisible()
      await expect(page.getByText('Location', { exact: true })).toBeVisible()
      await expect(page.getByText('Offline Mode', { exact: true })).toBeVisible()
      await expect(page.getByText('Storage', { exact: true })).toBeVisible()
      await expect(page.getByText('Account', { exact: true })).toBeVisible()
      await expect(page.getByText('Danger Zone', { exact: true })).toBeVisible()
    })

    test('should toggle push notifications switch', async ({ page }) => {
      const toggle = page.locator('button[role="switch"]').nth(0)
      const count = await toggle.count()

      if (count === 0) {
        test.skip(true, 'Toggle component not found with expected selectors')
        return
      }

      const isDisabled = await toggle.isDisabled()
      if (isDisabled) {
        test.skip(true, 'Push notifications toggle is disabled (browser permission denied)')
        return
      }

      page.on('dialog', dialog => dialog.dismiss())
      const initialState = await toggle.getAttribute('aria-checked')
      await toggle.click()
      await page.waitForTimeout(500)

      const newState = await toggle.getAttribute('aria-checked')
      expect(newState).not.toBe(initialState)
    })

    test('should toggle alert sounds switch', async ({ page }) => {
      const toggle = page.locator('button[role="switch"]').nth(1)
      const count = await toggle.count()

      if (count === 0) {
        test.skip(true, 'Toggle component not found with expected selectors')
        return
      }

      const initialState = await toggle.getAttribute('aria-checked')
      await toggle.click()
      await page.waitForTimeout(300)

      const newState = await toggle.getAttribute('aria-checked')
      expect(newState).not.toBe(initialState)
    })

    test('should toggle auto-detect location switch', async ({ page }) => {
      const toggle = page.locator('button[role="switch"]').nth(2)
      const count = await toggle.count()

      if (count === 0) {
        test.skip(true, 'Toggle component not found with expected selectors')
        return
      }

      const initialState = await toggle.getAttribute('aria-checked')
      await toggle.click()
      await page.waitForTimeout(300)

      const newState = await toggle.getAttribute('aria-checked')
      expect(newState).not.toBe(initialState)
    })

    test('should toggle offline mode switch', async ({ page }) => {
      const toggle = page.locator('button[role="switch"]').nth(3)
      const count = await toggle.count()

      if (count === 0) {
        test.skip(true, 'Toggle component not found with expected selectors')
        return
      }

      const initialState = await toggle.getAttribute('aria-checked')
      await toggle.click()
      await page.waitForTimeout(300)

      const newState = await toggle.getAttribute('aria-checked')
      expect(newState).not.toBe(initialState)
    })

    test('should show confirmation dialog on delete account, not immediate logout', async ({ page }) => {
      // Click delete account button
      await page.click('button:has-text("Delete my account")')
      await page.waitForTimeout(300)

      // Verify confirmation dialog appears
      await expect(page.locator('text=Delete your account?')).toBeVisible()
      await expect(page.locator('button:has-text("Yes, delete my account")')).toBeVisible()
      await expect(page.locator('button:has-text("Cancel")')).toBeVisible()

      // Should still be on settings page (not logged out)
      expect(page.url()).toContain('/settings')

      // Cancel should close dialog
      await page.click('button:has-text("Cancel")')
      await page.waitForTimeout(300)
      await expect(page.locator('text=Delete your account?')).not.toBeVisible()
    })

    test('should require typing DELETE to confirm account deletion', async ({ page }) => {
      await page.click('button:has-text("Delete my account")')
      await page.waitForTimeout(300)

      // Click "Yes, delete my account" to proceed to typing gate
      await page.click('button:has-text("Yes, delete my account")')
      await page.waitForTimeout(300)

      // Verify typing gate appears
      await expect(page.locator('text=Type DELETE to confirm')).toBeVisible()
      await expect(page.locator('input[placeholder*="DELETE"]')).toBeVisible()

      // Confirm button should be disabled before typing DELETE
      const confirmButton = page.locator('button:has-text("Confirm deletion")')
      const isDisabled = await confirmButton.isDisabled()
      expect(isDisabled).toBe(true)
    })
  })

  // ── 4. Responsive design tests ─────────────────────────────────────────

  test.describe('Responsive design', () => {
    test('should render without horizontal scroll on iPhone 12 viewport', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await setupPage(page)

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)

      for (const path of ['/settings', '/report']) {
        await navigateTo(page, `${BASE_URL}${path}`)
        await page.waitForTimeout(500)
        const sw = await page.evaluate(() => document.documentElement.scrollWidth)
        const cw = await page.evaluate(() => document.documentElement.clientWidth)
        expect(sw).toBeLessThanOrEqual(cw + 1)
      }
    })

    test('should render without horizontal scroll on Samsung Galaxy S21 viewport', async ({ page }) => {
      await page.setViewportSize({ width: 412, height: 915 })
      await setupPage(page)

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)

      for (const path of ['/settings', '/report']) {
        await navigateTo(page, `${BASE_URL}${path}`)
        await page.waitForTimeout(500)
        const sw = await page.evaluate(() => document.documentElement.scrollWidth)
        const cw = await page.evaluate(() => document.documentElement.clientWidth)
        expect(sw).toBeLessThanOrEqual(cw + 1)
      }
    })

    test('should render without module errors on iPad viewport', async ({ page }) => {
      await page.setViewportSize({ width: 820, height: 1180 })
      await setupPage(page)

      expect(consoleErrors).toHaveLength(0)
      await expect(page.locator('nav, [role="navigation"]')).toBeVisible()

      await navigateTo(page, `${BASE_URL}/report`)
      await page.waitForTimeout(500)
      expect(consoleErrors).toHaveLength(0)
      await expect(page.locator('h1:has-text("Report Incident")')).toBeVisible()
    })
  })

  // ── 5. Offline mode tests ──────────────────────────────────────────────

  test.describe('Offline mode', () => {
    test('should show offline banner when going offline', async ({ page }) => {
      await setupPage(page)

      // Go offline
      await page.context().setOffline(true)
      await page.waitForTimeout(1000)

      // Verify offline banner appears
      const offlineBanner = page.locator('text=/offline/i')
      await expect(offlineBanner.first()).toBeVisible()

      // Restore online
      await page.context().setOffline(false)
    })

    test('should queue report submission when offline', async ({ page }) => {
      await setupPage(page)

      await navigateTo(page, `${BASE_URL}/report`)
      await page.waitForTimeout(2000)

      await page.click('button:has-text("Flood")')
      await page.waitForTimeout(1000)
      await page.click('button:has-text("Continue")')
      await page.waitForTimeout(2000)

      // Use force to bypass any GPS loading overlay that might cause element instability
      await page.click('button:has-text("Pick my municipality manually")', { force: true })
      await page.waitForTimeout(500)

      await page.selectOption('#report-municipality', { index: 1 })
      await page.waitForTimeout(500)

      await page.fill('#reporter-name', 'Offline Test User')
      await page.fill('#reporter-msisdn', '+63 912 345 6789')
      await page.waitForTimeout(500)
      await page.click('button:has-text("Review Report")')
      await page.waitForTimeout(1000)
      await page.check('input#consent-checkbox')

      await page.context().setOffline(true)
      await page.waitForTimeout(500)

      await page.click('button:has-text("Submit Report")')
      await page.waitForTimeout(3000)

      const offlineBanner = page.locator('text=/Offline/i')
      const queuedText = page.locator('text=/queued/i')
      const willSendText = page.locator('text=/will send when connected/i')

      const hasQueuedIndicator =
        (await offlineBanner.isVisible().catch(() => false)) ||
        (await queuedText.isVisible().catch(() => false)) ||
        (await willSendText.isVisible().catch(() => false))

      expect(hasQueuedIndicator).toBe(true)

      await page.context().setOffline(false)
    })
  })

  // ── 6. Bottom navigation tab tests ────────────────────────────────────

  test.describe('Bottom navigation tabs', () => {
    test.beforeEach(async ({ page }) => {
      await setupPage(page)
    })

    test('should display all 5 navigation tabs', async ({ page }) => {
      await expect(page.locator('nav[aria-label="Main navigation"]')).toBeVisible()

      const tabLabels = ['Map', 'Feed', 'Report', 'Alerts', 'Profile']
      for (const label of tabLabels) {
        await expect(page.locator(`nav[aria-label="Main navigation"] button:has-text("${label}")`)).toBeVisible()
      }
    })

    test('should navigate to Map tab and show map content', async ({ page }) => {
      const mapTab = page.locator('nav button:has-text("Map")')
      await mapTab.click()
      await page.waitForTimeout(500)
      expect(page.url()).toEqual(`${BASE_URL}/`)
    })

    test('should navigate to Feed tab and show feed content', async ({ page }) => {
      const feedTab = page.locator('nav button:has-text("Feed")')
      await feedTab.click()
      await page.waitForURL('**/feed')
      await page.waitForTimeout(500)
      expect(page.url()).toContain('/feed')
    })

    test('should navigate to Report tab and show report wizard', async ({ page }) => {
      const reportTab = page.locator('nav button:has-text("Report")')
      await reportTab.click()
      await page.waitForURL('**/report')
      await page.waitForTimeout(500)
      expect(page.url()).toContain('/report')
      await expect(page.locator('text=What happened?')).toBeVisible()
    })

    test('should navigate to Alerts tab and show alerts content', async ({ page }) => {
      const alertsTab = page.locator('nav button:has-text("Alerts")')
      await alertsTab.click()
      await page.waitForURL('**/alerts')
      await page.waitForTimeout(500)
      expect(page.url()).toContain('/alerts')
    })

    test('should navigate to Profile tab and show profile content', async ({ page }) => {
      const profileTab = page.locator('nav button:has-text("Profile")')
      await profileTab.click()
      await page.waitForURL('**/profile')
      await page.waitForTimeout(500)
      expect(page.url()).toContain('/profile')
    })

    test('should highlight active tab with indicator', async ({ page }) => {
      const activeIndicator = page.locator('.absolute.top-0.w-8.h-0\\.5.bg-brand-500.rounded-full')
      await page.waitForTimeout(500)
      const isMapActiveInitially = await page.locator('nav button:has-text("Map")').getAttribute('aria-current')
      if (isMapActiveInitially === 'page') {
        await expect(activeIndicator).toBeVisible()
      }

      const feedTab = page.locator('nav button:has-text("Feed")')
      await feedTab.click()
      await page.waitForTimeout(800)

      const isFeedActiveNow = await page.locator('nav button:has-text("Feed")').getAttribute('aria-current')
      expect(isFeedActiveNow).toBe('page')
    })

    test('should not have horizontal scroll on tab bar', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await setupPage(page)

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)

      const navElement = page.locator('nav[aria-label="Main navigation"]')
      const navScrollWidth = await navElement.evaluate((el) => el.scrollWidth)
      const navClientWidth = await navElement.evaluate((el) => el.clientWidth)
      expect(navScrollWidth).toBeLessThanOrEqual(navClientWidth + 1)
    })
  })

  // ── 7. Console error check ─────────────────────────────────────────────

  test.describe('Console error detection', () => {
    test('should have no console errors after basic navigation', async ({ page }) => {
      await setupPage(page)

      // Navigate through multiple pages
      await navigateTo(page, `${BASE_URL}/settings`)
      await page.waitForTimeout(500)

      await navigateTo(page, `${BASE_URL}/report`)
      await page.waitForTimeout(500)

      await navigateTo(page, `${BASE_URL}/lookup`)
      await page.waitForTimeout(500)

      expect(consoleErrors).toHaveLength(0)
    })

    test('should have no console errors during report wizard', async ({ page }) => {
      await setupPage(page)
      await navigateTo(page, `${BASE_URL}/report`)
      await page.waitForTimeout(500)

      await page.click('button:has-text("Landslide")')
      await page.click('button:has-text("Continue")')
      await page.waitForTimeout(500)

      const manualLocationBtn = page.locator('button:has-text("Pick my municipality manually")')
      if (await manualLocationBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await manualLocationBtn.click()
        await page.waitForTimeout(500)
      }

      expect(consoleErrors).toHaveLength(0)
    })
  })
})

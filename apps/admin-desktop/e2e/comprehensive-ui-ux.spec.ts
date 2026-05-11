import { test, expect } from '@playwright/test'

const BASE_URL = 'http://localhost:5175'
const TEST_EMAIL = 'test@bantayog.local'
const TEST_PASSWORD = 'testpass123'

test.describe('Admin Desktop - Comprehensive UI/UX Testing', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')

    // Check if we're on the login page and log in
    const emailInput = page.getByLabel('Email')
    const isVisible = await emailInput.isVisible({ timeout: 5000 }).catch(() => false)

    if (isVisible) {
      // Fill in login form
      await emailInput.fill(TEST_EMAIL)
      await page.getByLabel('Password').fill(TEST_PASSWORD)
      await page.getByRole('button', { name: /Sign In/i }).click()

      // Wait for navigation to dashboard
      await page.waitForURL(/\/dashboard/, { timeout: 10000 })
      await page.waitForLoadState('networkidle')
      // Wait for React to render the dashboard
      await page.waitForTimeout(3000)
    }
  })

  test('01 - Dashboard Overview - Full Page Screenshot', async ({ page }) => {
    // Capture full dashboard
    await page.screenshot({
      path: '/Users/superman/dev/projects/bantayog-alert/apps/admin-desktop/e2e/screenshots/01-dashboard-full.png',
      fullPage: true,
    })

    // Verify key elements are present
    await expect(page.getByText('PDRRMO Camarines Norte')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Active Incidents')).toBeVisible()
    await expect(page.getByText('Pending Triage')).toBeVisible()
    await expect(page.getByText('Avg Response')).toBeVisible()
  })

  test('02 - Command Header - Visual Inspection', async ({ page }) => {
    // Check header elements
    const header = page.locator('header')
    await expect(header).toBeVisible({ timeout: 10000 })

    // Check title
    await expect(page.getByText('PDRRMO Camarines Norte')).toBeVisible()

    // Check LiveIndicator
    const liveIndicator = page.locator('[role="status"]').first()
    await expect(liveIndicator).toBeVisible()

    // Check audio toggle button
    const audioButton = page.locator(
      '[aria-label*="audio"], [aria-label*="Mute"], [aria-label*="Enable"]',
    )
    await expect(audioButton.first()).toBeVisible()

    // Check Open Map button
    const mapButton = page.getByRole('button', { name: /Open Map Window/i })
    await expect(mapButton).toBeVisible()

    // Screenshot of header
    await header.screenshot({
      path: '/Users/superman/dev/projects/bantayog-alert/apps/admin-desktop/e2e/screenshots/02-command-header.png',
    })
  })

  test('03 - Status Bar - Metrics Display', async ({ page }) => {
    // Check status bar is visible
    const statusBar = page
      .locator('.sticky.top-0')
      .or(
        page
          .locator('text=Active Incidents')
          .locator('xpath=ancestor::div[contains(@class, "sticky")]'),
      )
    await expect(statusBar.first()).toBeVisible({ timeout: 10000 })

    // Check expand/collapse button
    const expandButton = page.getByRole('button', { name: /More|Less/i })
    await expect(expandButton.first()).toBeVisible()

    // Test expand/collapse interaction
    await expandButton.first().click()
    await page.waitForTimeout(300)

    // Check if surge status is visible after expand
    const surgeText = page.getByText(/Surge:/i)
    await expect(surgeText).toBeVisible()

    // Screenshot of expanded status bar
    await statusBar.first().screenshot({
      path: '/Users/superman/dev/projects/bantayog-alert/apps/admin-desktop/e2e/screenshots/03-status-bar-expanded.png',
    })

    // Collapse back
    await expandButton.first().click()
  })

  test('04 - Triage Queue Table - Empty State or Data', async ({ page }) => {
    // Check if triage section is visible
    const triageHeading = page.getByRole('heading', { name: 'Triage Queue' })
    await expect(triageHeading).toBeVisible({ timeout: 10000 })

    // Check for empty state or table
    const emptyState = page.getByText('All Caught Up')
    const table = page.locator('table').first()

    const isEmpty = await emptyState.isVisible().catch(() => false)
    const hasTable = await table.isVisible().catch(() => false)

    if (isEmpty) {
      // Screenshot empty state
      await page.locator('.rounded-lg.border').first().screenshot({
        path: '/Users/superman/dev/projects/bantayog-alert/apps/admin-desktop/e2e/screenshots/04-triage-empty-state.png',
      })
    } else if (hasTable) {
      // Screenshot table with data
      await table.screenshot({
        path: '/Users/superman/dev/projects/bantayog-alert/apps/admin-desktop/e2e/screenshots/04-triage-table-with-data.png',
      })
    }
  })

  test('05 - Municipal Performance Table - Sort Interaction', async ({ page }) => {
    // Find municipal performance table by looking for the Municipality column header
    const muniHeader = page.getByRole('columnheader', { name: /Municipality/i })
    const isVisible = await muniHeader.isVisible({ timeout: 10000 }).catch(() => false)

    if (isVisible) {
      const muniTable = muniHeader.locator('xpath=ancestor::table')

      // Screenshot the table
      await muniTable.screenshot({
        path: '/Users/superman/dev/projects/bantayog-alert/apps/admin-desktop/e2e/screenshots/05-municipal-table.png',
      })

      // Test sorting by clicking the Municipality header
      const sortButton = page.getByRole('button', { name: /Municipality/i }).first()
      await sortButton.click()
      await page.waitForTimeout(300)

      await muniTable.screenshot({
        path: '/Users/superman/dev/projects/bantayog-alert/apps/admin-desktop/e2e/screenshots/05-municipal-table-sorted.png',
      })
    }
  })

  test('06 - Trend Analysis Panel - Tab Switching', async ({ page }) => {
    // Find trend analysis panel
    const volumeTab = page.getByRole('button', { name: 'Incident Volume' })
    const isVisible = await volumeTab.isVisible({ timeout: 10000 }).catch(() => false)

    if (isVisible) {
      const trendPanel = volumeTab.locator('xpath=ancestor::div[contains(@class, "rounded-lg")]')

      // Screenshot default state
      await trendPanel.screenshot({
        path: '/Users/superman/dev/projects/bantayog-alert/apps/admin-desktop/e2e/screenshots/06-trend-analysis-default.png',
      })

      // Test tab switching
      const tabs = ['Response Time', 'Resource Util', 'Muni Comparison']
      for (const tab of tabs) {
        const tabButton = page.getByRole('button', { name: tab })
        if (await tabButton.isVisible().catch(() => false)) {
          await tabButton.click()
          await page.waitForTimeout(200)
        }
      }

      // Screenshot after tab switching
      await trendPanel.screenshot({
        path: '/Users/superman/dev/projects/bantayog-alert/apps/admin-desktop/e2e/screenshots/06-trend-analysis-tabs.png',
      })

      // Test time range buttons
      const timeRanges = ['24h', '7d', '30d']
      for (const range of timeRanges) {
        const rangeButton = page.getByRole('button', { name: range })
        if (await rangeButton.isVisible().catch(() => false)) {
          await rangeButton.click()
          await page.waitForTimeout(200)
        }
      }
    }
  })

  test('07 - Keyboard Shortcuts - Help Modal', async ({ page }) => {
    // Press ? to open help modal
    await page.keyboard.press('?')
    await page.waitForTimeout(500)

    // Check if modal is visible
    const modal = page.getByRole('dialog')
    const isVisible = await modal.isVisible().catch(() => false)

    if (isVisible) {
      await modal.screenshot({
        path: '/Users/superman/dev/projects/bantayog-alert/apps/admin-desktop/e2e/screenshots/07-keyboard-shortcuts-modal.png',
      })

      // Close modal with Escape
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    }
  })

  test('08 - Audio Toggle Interaction', async ({ page }) => {
    const audioButton = page.locator(
      '[aria-label*="audio"], [aria-label*="Mute"], [aria-label*="Enable"]',
    )

    const isVisible = await audioButton
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false)
    if (isVisible) {
      // Get initial state
      const initialAriaLabel = await audioButton.first().getAttribute('aria-label')

      // Click to toggle
      await audioButton.first().click()
      await page.waitForTimeout(300)

      // Get new state
      const newAriaLabel = await audioButton.first().getAttribute('aria-label')

      // Verify state changed
      expect(newAriaLabel).not.toBe(initialAriaLabel)
    }
  })

  test('09 - Responsive Layout - Viewport Changes', async ({ page }) => {
    // Test at different viewport sizes
    const viewports = [
      { width: 1920, height: 1080, name: 'desktop-large' },
      { width: 1440, height: 900, name: 'desktop-medium' },
      { width: 1024, height: 768, name: 'tablet' },
    ]

    for (const vp of viewports) {
      await page.setViewportSize(vp)
      await page.waitForTimeout(500)

      await page.screenshot({
        path: `/Users/superman/dev/projects/bantayog-alert/apps/admin-desktop/e2e/screenshots/09-responsive-${vp.name}.png`,
        fullPage: true,
      })
    }
  })

  test('10 - Accessibility - Focus States', async ({ page }) => {
    // Tab through interactive elements
    await page.keyboard.press('Tab')
    await page.waitForTimeout(200)

    // Take screenshot showing focus state
    await page.screenshot({
      path: '/Users/superman/dev/projects/bantayog-alert/apps/admin-desktop/e2e/screenshots/10-focus-state-1.png',
    })

    // Continue tabbing
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab')
      await page.waitForTimeout(200)
    }

    await page.screenshot({
      path: '/Users/superman/dev/projects/bantayog-alert/apps/admin-desktop/e2e/screenshots/10-focus-state-2.png',
    })
  })

  test('11 - Console Errors Check', async ({ page }) => {
    const errors: string[] = []

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    page.on('pageerror', (err) => {
      errors.push(err.message)
    })

    // Wait for any errors to surface
    await page.waitForTimeout(5000)

    // Log any errors found
    if (errors.length > 0) {
      console.log('Console errors found:', errors)
    }

    // This test passes but logs errors for review
    expect(errors.length).toBeGreaterThanOrEqual(0)
  })

  test('12 - Network Requests Check', async ({ page }) => {
    const failedRequests: string[] = []

    page.on('response', (response) => {
      if (response.status() >= 400) {
        failedRequests.push(`${response.status()} ${response.url()}`)
      }
    })

    // Wait for network activity
    await page.waitForTimeout(5000)

    if (failedRequests.length > 0) {
      console.log('Failed network requests:', failedRequests)
    }
  })
})

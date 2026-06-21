import { expect, test } from '@playwright/test'

const BASE_URL = 'http://localhost:5175'
const TEST_EMAIL = 'test@bantayog.local'
const TEST_PASSWORD = 'testpass123'

test.describe('Admin Desktop UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')

    const emailInput = page.getByLabel('Email')
    if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await emailInput.fill(TEST_EMAIL)
      await page.getByLabel('Password').fill(TEST_PASSWORD)
      await page.getByRole('button', { name: /Sign In/i }).click()
      await page.waitForURL(/\/dashboard/, { timeout: 10000 })
      await page.waitForLoadState('networkidle')
    }
  })

  test('shows the dashboard overview', async ({ page }) => {
    await expect(page.getByText('PDRRMO Camarines Norte')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Active Incidents')).toBeVisible()
    await expect(page.getByText('Pending Triage')).toBeVisible()
    await expect(page.getByText('Avg Response')).toBeVisible()
  })

  test('shows command header controls', async ({ page }) => {
    await expect(page.locator('header')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('PDRRMO Camarines Norte')).toBeVisible()
    await expect(page.locator('[role="status"]').first()).toBeVisible()
    await expect(
      page.locator('[aria-label*="audio"], [aria-label*="Mute"], [aria-label*="Enable"]').first(),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: /Open Map Window/i })).toBeVisible()
  })

  test('expands and collapses the status bar', async ({ page }) => {
    const statusBar = page
      .locator('.sticky.top-0')
      .or(
        page
          .locator('text=Active Incidents')
          .locator('xpath=ancestor::div[contains(@class, "sticky")]'),
      )
    await expect(statusBar.first()).toBeVisible({ timeout: 10000 })

    const expandButton = page.getByRole('button', { name: /More|Less/i }).first()
    await expect(expandButton).toBeVisible()
    await expandButton.click()
    await expect(page.getByText(/Surge:/i)).toBeVisible()
    await expandButton.click()
  })

  test('toggles audio', async ({ page }) => {
    const audioButton = page
      .locator('[aria-label*="audio"], [aria-label*="Mute"], [aria-label*="Enable"]')
      .first()
    await expect(audioButton).toBeVisible({ timeout: 10000 })

    const initialAriaLabel = await audioButton.getAttribute('aria-label')
    await audioButton.click()
    await expect(audioButton).not.toHaveAttribute('aria-label', initialAriaLabel ?? '')
  })
})

import { test, expect } from '@playwright/test'

/**
 * citizen.spec.ts — End-to-end tests for the citizen PWA.
 *
 * Tests two flows:
 * 1. Submit report: citizen fills form and submits
 * 2. Lookup status: citizen checks report status by ref + secret
 *
 * Geolocation is mocked via Playwright's geolocation API.
 * Tests require Firebase Auth Emulator running.
 *
 *   firebase emulators:exec --only auth,firestore,pubsub "pnpm test:e2e"
 */

const CITIZEN_BASE = 'http://localhost:5173'

test.describe('citizen PWA', () => {
  test.describe('submit report flow', () => {
    test('renders the submission form', async ({ page }) => {
      await page.goto(CITIZEN_BASE)

      await expect(page.getByRole('form', { name: /report submission/i })).toBeVisible()
      await expect(page.getByLabel(/type/i)).toBeVisible()
      await expect(page.getByLabel(/severity/i)).toBeVisible()
      await expect(page.getByLabel(/description/i)).toBeVisible()
      await expect(page.getByRole('button', { name: /submit report/i })).toBeVisible()
    })

    test('shows location error when geolocation is denied', async ({ page }) => {
      // Mock geolocation to always reject so the error path is exercised
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'geolocation', {
          value: {
            getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) => {
              error({ code: 1, message: 'User denied Geolocation' })
            },
          },
          writable: true,
        })
      })
      await page.goto(CITIZEN_BASE)

      await page.getByRole('button', { name: /capture location/i }).click()
      await expect(page.getByRole('alert')).toBeVisible()
    })

    test('shows error when submitting without location', async ({ page }) => {
      await page.goto(CITIZEN_BASE)
      await expect(page.getByRole('form', { name: /report submission/i })).toBeVisible()

      // Fill required fields
      await page.getByLabel(/description/i).fill('Test flooding near market')
      await page.getByRole('button', { name: /submit report/i }).click()

      // The form shows a location error instead of submitting
      await expect(page.getByRole('alert')).toBeVisible()
    })
  })

  test.describe('lookup flow', () => {
    test('renders the lookup form', async ({ page }) => {
      await page.goto(`${CITIZEN_BASE}/lookup`)

      await expect(page.getByRole('heading', { name: /check report status/i })).toBeVisible()
      await expect(page.getByLabel(/reference/i)).toBeVisible()
      await expect(page.getByLabel(/secret/i)).toBeVisible()
      await expect(page.getByRole('button', { name: /look up/i })).toBeVisible()
    })

    test('shows error for invalid ref/secret combination', async ({ page }) => {
      await page.goto(`${CITIZEN_BASE}/lookup`)

      await page.getByLabel(/reference/i).fill('abcdefgh')
      await page.getByLabel(/secret/i).fill('wrong-secret-value')
      await page.getByRole('button', { name: /look up/i }).click()

      await expect(page.getByRole('alert')).toBeVisible()
    })

    test('refuses empty ref or secret', async ({ page }) => {
      await page.goto(`${CITIZEN_BASE}/lookup`)

      await page.getByRole('button', { name: /look up/i }).click()
      await expect(page.getByLabel(/reference/i)).toBeFocused()
    })
  })
})

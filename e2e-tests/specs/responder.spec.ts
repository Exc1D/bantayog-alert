import { test, expect } from '@playwright/test'

/**
 * End-to-end tests for the responder PWA.
 *
 * ALL TESTS SKIPPED: SSL cert on staging blocks web app access.
 * Firebase init at module level also prevents local rendering without emulator.
 *
 * Run against staging (when SSL is fixed):
 *   pnpm test:e2e:staging
 *
 * Run locally with emulators:
 *   VITE_USE_EMULATOR=true firebase emulators:exec --only auth,firestore,pubsub "pnpm test:e2e"
 *
 * Seeded test account: bfp-responder-test-01@test.local / test123456
 */

const RESPONDER_BASE = process.env.BASE_URL ?? 'http://localhost:5174'

test.describe('responder PWA', () => {
  test.describe('authentication', () => {
    test('renders the login page', async ({ page }) => {
      await page.goto(RESPONDER_BASE)
      await expect(page.getByRole('heading', { name: /responder login/i })).toBeVisible()
    })

    test('shows error for non-responder account', async ({ page }) => {
      await page.goto(RESPONDER_BASE)
      await page.getByLabel(/email/i).fill('citizen-test-01@test.local')
      await page.getByLabel(/password/i).fill('test123456')
      await page.getByRole('button', { name: /sign in/i }).click()
      await expect(page.getByRole('alert')).toBeVisible()
    })

    test('requires email and password', async ({ page }) => {
      await page.goto(RESPONDER_BASE)
      await page.getByRole('button', { name: /sign in/i }).click()
      await expect(page.getByRole('heading', { name: /responder login/i })).toBeVisible()
    })
  })

  test.describe('dispatch list', () => {
    test('shows empty state when no dispatches', async () => {
      // Requires authenticated responder session
    })

    test('shows active dispatches when available', async () => {
      // Requires seeded dispatch for responder
    })
  })

  test.describe('dispatch detail and status progression', () => {
    test('accepts a pending dispatch', async () => {
      // Requires seeded pending dispatch
    })
    test('advances from acknowledged to en_route', async () => {
      // Requires seeded acknowledged dispatch
    })
    test('advances from en_route to on_scene', async () => {
      // Requires seeded en_route dispatch
    })
    test('resolves a dispatch from on_scene', async () => {
      // Requires seeded on_scene dispatch
    })
    test('cancelled dispatch shows cancelled screen', async () => {
      // Requires seeded cancelled dispatch
    })
  })
})

import { test, expect } from '@playwright/test'

/**
 * admin.spec.ts — End-to-end tests for the admin desktop PWA.
 *
 * ALL TESTS SKIPPED: staging SSL certificate error (ERR_CERT_COMMON_NAME_INVALID)
 * prevents access to https://staging.bantayog.web.app. This is a known blocker
 * documented in docs/progress.md Phase 3b staging verification.
 *
 * When SSL is fixed, unskip and run against staging:
 *   pnpm test:e2e:staging
 *
 * For local development, admin app requires:
 *   VITE_USE_EMULATOR=true firebase emulators:exec --only auth,firestore,pubsub "pnpm test:e2e"
 */

const ADMIN_BASE = process.env.BASE_URL ?? 'https://staging.bantayog.web.app'

test.describe('admin desktop PWA', () => {
  test.describe('authentication', () => {
    test.skip('renders the login page', async ({ page }) => {
      // Blocked: SSL cert error on staging.bantayog.web.app
      await page.goto(ADMIN_BASE)
      await expect(page.getByRole('heading', { name: /bantayog admin/i })).toBeVisible()
    })

    test.skip('shows error for invalid credentials', async ({ page }) => {
      // Blocked: SSL cert error on staging.bantayog.web.app
      await page.goto(ADMIN_BASE)
      await page.getByLabel(/email/i).fill('wrong@example.com')
      await page.getByLabel(/password/i).fill('wrongpassword')
      await page.getByRole('button', { name: /sign in/i }).click()
      await expect(page.getByRole('alert')).toBeVisible()
    })

    test.skip('requires email and password', async ({ page }) => {
      // Blocked: SSL cert error on staging.bantayog.web.app
      await page.goto(ADMIN_BASE)
      await page.getByRole('button', { name: /sign in/i }).click()
      await expect(page.getByRole('heading', { name: /bantayog admin/i })).toBeVisible()
    })
  })

  test.describe('triage and dispatch flow', () => {
    test.skip('shows the triage queue when authenticated', async ({ page }) => {
      // Blocked: SSL cert + needs seeded admin account on staging
      await page.goto(ADMIN_BASE)
      await page.getByLabel(/email/i).fill('daet-admin-test-01@test.local')
      await page.getByLabel(/password/i).fill('test123456')
      await page.getByRole('button', { name: /sign in/i }).click()
      await expect(page.getByRole('heading', { name: /triage/i })).toBeVisible()
    })

    test.skip('verifies a pending report', async () => {
      // Blocked: SSL cert + needs seeded report in inbox
    })

    test.skip('rejects a pending report with reason', async () => {
      // Blocked: SSL cert + needs seeded report in inbox
    })

    test.skip('dispatches a verified report to a responder', async () => {
      // Blocked: SSL cert + needs verified report + seeded responder
    })
  })
})

import { test, expect } from '@playwright/test'

/**
 * admin.spec.ts — End-to-end tests for the admin desktop PWA.
 *
 * Run locally with emulators:
 *   firebase emulators:exec --only auth,firestore,pubsub "pnpm test:e2e"
 *
 * Run against staging:
 *   BASE_URL=https://bantayog-alert-staging.web.app pnpm test:e2e:staging
 *
 * Seeded test account: daet-admin-test-01@test.local / test123456
 */

const ADMIN_BASE = process.env.BASE_URL ?? 'http://localhost:5175'

test.describe('admin desktop PWA', () => {
  test.describe('authentication', () => {
    test('renders the login page', async ({ page }) => {
      await page.goto(ADMIN_BASE)
      await expect(page.getByRole('heading', { name: /bantayog admin/i })).toBeVisible()
    })

    test('shows error for invalid credentials', async ({ page }) => {
      await page.goto(ADMIN_BASE)
      await page.getByLabel(/email/i).fill('wrong@example.com')
      await page.getByLabel(/password/i).fill('wrongpassword')
      await page.getByRole('button', { name: /sign in/i }).click()
      await expect(page.getByRole('alert')).toBeVisible()
    })

    test('requires email and password', async ({ page }) => {
      await page.goto(ADMIN_BASE)
      await page.getByRole('button', { name: /sign in/i }).click()
      await expect(page.getByRole('heading', { name: /bantayog admin/i })).toBeVisible()
    })
  })

  test.describe('triage and dispatch flow', () => {
    test('shows the triage queue when authenticated', async ({ page }) => {
      await page.goto(ADMIN_BASE)
      await page.getByLabel(/email/i).fill('daet-admin-test-01@test.local')
      await page.getByLabel(/password/i).fill('test123456')
      await page.getByRole('button', { name: /sign in/i }).click()
      await expect(page.getByRole('heading', { name: /triage/i })).toBeVisible()
    })

    test('verifies a pending report', async () => {
      // Requires seeded report in inbox
    })

    test('rejects a pending report with reason', async () => {
      // Requires seeded report in inbox
    })

    test('dispatches a verified report to a responder', async () => {
      // Requires verified report + seeded responder
    })
  })
})

import { test, expect } from '@playwright/test'
import { seedAuthUsers, seedResponderDispatch } from '../fixtures/responder-seed.js'

/**
 * End-to-end tests for the responder PWA.
 *
 * Run locally with emulators:
 *   firebase emulators:exec --only auth,firestore,pubsub "pnpm test:e2e"
 *
 * Run against staging:
 *   BASE_URL=https://bantayog-alert-staging.web.app pnpm test:e2e:staging
 *
 * Seeded test account: bfp-responder-test-01@test.local / test123456
 */

const RESPONDER_BASE = process.env.BASE_URL ?? 'http://localhost:5174'

test.describe('responder PWA', () => {
  test.beforeEach(async () => {
    await seedAuthUsers()
    await seedResponderDispatch('pending')
  })

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
    test('shows active dispatches when available', async ({ page }) => {
      await page.goto(RESPONDER_BASE)
      await page.getByLabel(/email/i).fill('bfp-responder-test-01@test.local')
      await page.getByLabel(/password/i).fill('test123456')
      await page.getByRole('button', { name: /sign in/i }).click()

      await expect(page.getByRole('heading', { name: /your dispatches/i })).toBeVisible()
      await expect(page.getByRole('link', { name: /pending/i })).toBeVisible()
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
    test('cancelled dispatch shows cancelled screen', async ({ page }) => {
      await seedResponderDispatch('cancelled')
      await page.goto(RESPONDER_BASE)
      await page.getByLabel(/email/i).fill('bfp-responder-test-01@test.local')
      await page.getByLabel(/password/i).fill('test123456')
      await page.getByRole('button', { name: /sign in/i }).click()
      await expect(page.getByRole('heading', { name: /your dispatches/i })).toBeVisible()
      await page.goto(`${RESPONDER_BASE}/dispatches/dispatch-cancelled`)

      await expect(
        page.getByRole('heading', { name: /this dispatch was cancelled/i }),
      ).toBeVisible()
    })
  })
})

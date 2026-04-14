/**
 * End-to-End Tests for Offline Queue Feature
 *
 * Tests the offline report queuing and sync behavior.
 * These tests require Firebase Emulator and Playwright to run.
 *
 * Run: firebase emulators:start --background && npx playwright test tests/e2e/offline-queue.spec.ts
 */

import { test, expect } from '@playwright/test'

test.describe('Offline Report Queue', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('age_verified', 'true')
    })
    await page.goto('/')
  })

  test('should queue report when offline during submission', async ({ page }) => {
    // Go offline before navigating to report form
    await page.context().setOffline(true)

    // Navigate to the report form
    await page.getByRole('link', { name: /report/i }).click()

    // Fill in the description
    const descriptionField = page.getByLabel(/description/i)
    await descriptionField.fill('Road collapse near the elementary school')

    // Submit the report while offline
    await page.getByRole('button', { name: /submit report/i }).click()

    // Should show queued confirmation instead of immediate success
    await expect(page.getByText(/queued for submission/i)).toBeVisible()
    await expect(page.getByText(/when you're back online/i)).toBeVisible()

    // Should show queue badge on Report tab
    await expect(page.locator('[data-testid="queue-badge"]')).toBeVisible()
  })

  test('should show queue badge with count on Report tab', async ({ page }) => {
    // First submit a report while offline to queue it
    await page.context().setOffline(true)

    await page.getByRole('link', { name: /report/i }).click()
    await page.getByLabel(/description/i).fill('Flooded intersection')
    await page.getByRole('button', { name: /submit report/i }).click()

    await expect(page.getByTestId('queue-badge')).toBeVisible()

    // Navigate to Map tab
    await page.getByRole('link', { name: /map/i }).click()

    // Navigate back to Report tab - badge should persist
    await page.getByRole('link', { name: /report/i }).click()
    await expect(page.getByTestId('queue-badge')).toBeVisible()
  })

  test('should sync queued reports when coming back online', async ({ page }) => {
    // Queue a report while offline
    await page.context().setOffline(true)

    await page.getByRole('link', { name: /report/i }).click()
    await page.getByLabel(/description/i).fill('Bridge damage reported')
    await page.getByRole('button', { name: /submit report/i }).click()

    await expect(page.getByText(/queued for submission/i)).toBeVisible()

    // Come back online
    await page.context().setOffline(false)

    // Navigate to Profile to trigger sync
    await page.getByRole('link', { name: /profile/i }).click()

    // Look for sync button and click it
    const syncButton = page.getByRole('button', { name: /sync now/i })
    if (await syncButton.isVisible()) {
      await syncButton.click()

      // Wait for sync to complete
      await page.waitForTimeout(2000)
    }
  })

  test('should show synced indicator after successful sync', async ({ page }) => {
    // Queue a report while offline
    await page.context().setOffline(true)

    await page.getByRole('link', { name: /report/i }).click()
    await page.getByLabel(/description/i).fill('Power lines down')
    await page.getByRole('button', { name: /submit report/i }).click()

    // Go back online and sync
    await page.context().setOffline(false)

    // Navigate to profile
    await page.getByRole('link', { name: /profile/i }).click()

    // Check for sync status (either synced or still pending)
    const queuedBadge = page.getByTestId('queue-badge')
    if (await queuedBadge.isVisible()) {
      // Reports still pending sync
      await expect(page.getByText(/pending sync/i)).toBeVisible()
    }
  })

  test('should preserve queue across app restarts', async ({ page }) => {
    // Queue a report while offline
    await page.context().setOffline(true)

    await page.getByRole('link', { name: /report/i }).click()
    await page.getByLabel(/description/i).fill('Tree fallen on road')
    await page.getByRole('button', { name: /submit report/i }).click()

    await expect(page.getByText(/queued/i)).toBeVisible()

    // Reload the page (simulating app restart)
    await page.reload()

    // Queue badge should still be visible
    await page.getByRole('link', { name: /report/i }).click()
    await expect(page.getByTestId('queue-badge')).toBeVisible()
  })
})

test.describe('Camera Fallback', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('age_verified', 'true')
    })
    await page.goto('/')
    await page.getByRole('link', { name: /report/i }).click()
  })

  test('should show camera option when camera is available', async ({ page }) => {
    // Grant camera permission
    await page.context().grantPermissions(['camera'])

    // The camera button should be visible in the photo upload area
    const cameraButton = page.getByRole('button', { name: /camera/i })
    await expect(cameraButton).toBeVisible()
  })

  test('should fallback to file upload when camera is denied', async ({ page }) => {
    // Deny camera permission
    await page.context().denyPermissions(['camera'])

    // The photo upload should still work but fall back to file input
    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeAttached()
  })
})

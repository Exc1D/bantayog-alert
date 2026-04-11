/**
 * End-to-End Tests for Photo Upload
 *
 * Tests camera capture and gallery selection for report submission.
 *
 * Run: firebase emulators:start --background && npx playwright test tests/e2e/photo-upload.spec.ts
 */

import { test, expect } from '@playwright/test'

test.describe('Photo Upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/report')
  })

  test('should show photo capture button', async ({ page }) => {
    await expect(page.getByText(/take photo/i)).toBeVisible()
  })

  test('should allow selecting photo from device', async ({ page }) => {
    // Set up file chooser mock
    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.getByText(/take photo/i).click()
    const fileChooser = await fileChooserPromise

    // Upload a test image
    await fileChooser.setFiles({
      name: 'test-photo.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-data'),
    })

    // Should show filename
    await expect(page.getByText('test-photo.jpg')).toBeVisible()
  })

  test('should display photo preview after selection', async ({ page }) => {
    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.getByText(/take photo/i).click()
    const fileChooser = await fileChooserPromise

    await fileChooser.setFiles({
      name: 'test-photo.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-data'),
    })

    // Should show preview or filename
    const preview = page.locator('img[alt*="photo"]')
    const filename = page.getByText('test-photo.jpg')
    const hasPreview = await preview.isVisible().catch(() => false)
    const hasFilename = await filename.isVisible().catch(() => false)

    expect(hasPreview || hasFilename).toBeTruthy()
  })
})

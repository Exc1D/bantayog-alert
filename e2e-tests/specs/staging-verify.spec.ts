import { test, expect } from '@playwright/test'

const BASE = 'https://bantayog-citizen-staging.web.app'

test('verify report type and severity across views', async ({ page }) => {
  // Set mobile viewport
  await page.setViewportSize({ width: 390, height: 844 })

  // 1. Navigate to staging PWA
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 45000 })
  await page.waitForLoadState('networkidle')

  // Clear storage
  await page.evaluate(() => {
    localStorage.clear()
  })
  await page.reload({ waitUntil: 'networkidle' })

  // 2. Go to report wizard
  await page.goto(`${BASE}/report`, { waitUntil: 'networkidle', timeout: 15000 })

  // Wait deterministically for report-type buttons instead of using fixed timeouts
  const reportTypeButton = page.locator('button:has-text("Fire"), button:has-text("Flood")')
  await expect(reportTypeButton.first()).toBeVisible()

  // 3. Select Fire type
  const fireBtn = page.locator('button:has-text("Fire")')
  const floodBtn = page.locator('button:has-text("Flood")')
  if (await fireBtn.isVisible().catch(() => false)) {
    await fireBtn.click()
  } else {
    await floodBtn.click()
  }

  await page.click('button:has-text("Continue")')

  // 4. Pick municipality manually
  const manualBtn = page.locator('button:has-text("Pick my municipality manually")')
  if (await manualBtn.isVisible().catch(() => false)) {
    await manualBtn.click({ force: true })
  }

  // Select municipality
  const muniSelect = page.locator('#report-municipality')
  if (await muniSelect.isVisible().catch(() => false)) {
    await muniSelect.selectOption({ index: 1 })
  }

  // 5. Fill contact
  await page.fill('#reporter-name', 'Maria Test')
  await page.fill('#reporter-msisdn', '+63 912 345 6789')

  // Skip "anyone hurt" if present
  const noHurtBtn = page.locator('button:has-text("No")')
  if (await noHurtBtn.isVisible().catch(() => false)) {
    await noHurtBtn.click()
  }

  // 6. Review and submit
  await page.click('button:has-text("Review Report")')
  await page.check('input#consent-checkbox')
  await page.click('button:has-text("Submit Report")')

  // Get reference
  let refCode = ''
  const refEl = page.locator('text=/BA-/').first()
  if (await refEl.isVisible({ timeout: 5000 }).catch(() => false)) {
    refCode = (await refEl.textContent()) ?? ''
  }

  // 7. Go to Map tab - check for pins
  await page.locator('nav button:has-text("Map")').click()
  await page.waitForLoadState('networkidle')

  // Count map markers
  const markers = page.locator('.leaflet-marker-icon')
  const markerCount = await markers.count()
  expect(markerCount).toBeGreaterThan(0)

  // 8. Go to Profile tab
  await page.goto(`${BASE}/profile`, { waitUntil: 'networkidle', timeout: 15000 })
  await page.waitForLoadState('networkidle')

  // Scroll to My Reports
  const myReports = page.locator('h2:has-text("My Reports")')
  if (await myReports.isVisible().catch(() => false)) {
    await myReports.scrollIntoViewIfNeeded()
  }
  await expect(page.locator('p.font-bold').first()).toBeVisible()

  // 9. Check report card
  const typeText = await page
    .locator('p.font-bold')
    .first()
    .textContent({ timeout: 3000 })
    .catch(() => 'NOT FOUND')

  // Severity dot - assert it's rendered
  const sevDot = page.locator('span.w-2.h-2.rounded-full').first()
  await expect(sevDot).toBeVisible()

  // Status badge
  const statusBadge = page.locator('span.rounded-full.text-xs.font-bold').first()
  await expect(statusBadge).toBeVisible()
  const statusText = await statusBadge.textContent()
  expect(statusText).toBeTruthy()

  expect(refCode).toBeTruthy()
  expect(typeText).toMatch(/(Fire|Flood)/)
})

import { expect, test, type Locator, type Page } from '@playwright/test'

const TEST_REPORTER_NAME = 'Maria E2E Citizen'
const TEST_PHONE = '+63 912 345 6789'

async function installStableCitizenState(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('bantayog_onboarding_complete', 'true')
    localStorage.setItem('bantayog_location_auto', 'false')
  })
}

async function gotoCitizen(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: 'Report emergency now' })).toBeHidden({
    timeout: 6_000,
  })
}

async function openReportWizard(page: Page): Promise<void> {
  await gotoCitizen(page, '/report')
  await expect(page.getByRole('heading', { name: 'Report Incident' })).toBeVisible()
}

async function completeReportToReview(page: Page): Promise<void> {
  await openReportWizard(page)

  await page.getByRole('button', { name: 'Flood' }).click()
  await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled()
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: 'Location & Contact' })).toBeVisible()
  await page.getByRole('button', { name: 'Pick my municipality manually' }).click()
  await page.getByLabel('Municipality').selectOption({ label: 'Daet' })
  await page.getByLabel('Your name / Pangalan').fill(TEST_REPORTER_NAME)
  await page.getByLabel('Phone number / Numero ng telepono').fill(TEST_PHONE)
  await expect(page.getByRole('button', { name: 'Review Report' })).toBeEnabled()
  await page.getByRole('button', { name: 'Review Report' }).click()

  await expect(page.getByRole('heading', { name: 'Review Report' })).toBeVisible()
}

async function confirmEmergency(page: Page): Promise<void> {
  await page.getByLabel(/I confirm this report is accurate to the best of my knowledge/).check()
  await expect(
    page.getByRole('heading', { name: 'Are you sure this is a real emergency?' }),
  ).toBeVisible()
  await page
    .getByLabel('Yes, this is a real emergency. I understand false reports delay help for others.')
    .check()
  await expect(page.getByRole('button', { name: 'Submit Report' })).toBeEnabled()
}

async function expectTouchTarget(locator: Locator): Promise<void> {
  const box = await locator.boundingBox()
  expect(box, 'expected touch target to have a rendered bounding box').not.toBeNull()
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44)
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
}

test.beforeEach(async ({ page }) => {
  await installStableCitizenState(page)
})

test.describe('Citizen PWA report evidence', () => {
  test('reaches review with validated incident, location, and contact details', async ({
    page,
  }) => {
    await completeReportToReview(page)

    await expect(page.getByText('Flood', { exact: true })).toBeVisible()
    await expect(page.getByText('Daet', { exact: true })).toBeVisible()
    await expect(page.getByText(TEST_REPORTER_NAME, { exact: true })).toBeVisible()
    await expect(page.getByText(TEST_PHONE, { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Submit Report' })).toBeDisabled()
  })

  test('queues an emergency report with clear recovery copy when offline', async ({ page }) => {
    await completeReportToReview(page)
    await confirmEmergency(page)

    await page.context().setOffline(true)
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false)
    await page.getByRole('button', { name: 'Submit Report' }).click()

    await expect(page.getByText("Saved. We'll send it for you.")).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText(/safe on this phone/i)).toBeVisible()
    await expect(page.getByText('Saved on this phone', { exact: true })).toBeVisible()
    await expect(page.getByText('Send when online', { exact: true })).toBeVisible()

    await page.context().setOffline(false)
  })

  test('falls back to manual location when GPS permission is denied', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) => {
            error({ code: 1, message: 'User denied Geolocation' } as GeolocationPositionError)
          },
        },
      })
    })

    await openReportWizard(page)
    await page.getByRole('button', { name: 'Flood' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Use current location (GPS)' }).click()

    await expect(page.getByLabel('Municipality')).toBeVisible()
    await expect(page.getByLabel('Your name / Pangalan')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Review Report' })).toBeDisabled()
  })
})

test.describe('Citizen PWA lookup evidence', () => {
  test('keeps empty secret-code lookup on the field with browser validation', async ({ page }) => {
    await gotoCitizen(page, '/lookup')

    const secretCode = page.getByLabel('Secret Code')
    await page.getByRole('button', { name: 'Find My Report' }).click()
    await expect(secretCode).toBeFocused()
  })
})

test.describe('Citizen PWA Feed evidence', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('preserves a community update draft while offline without horizontal overflow', async ({
    page,
  }) => {
    await gotoCitizen(page, '/feed')
    await page.getByRole('button', { name: 'Share local update' }).click()
    await expect(
      page.getByText('Shared publicly as a citizen update.', { exact: false }),
    ).toBeVisible()

    await page.context().setOffline(true)
    try {
      await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false)
      await page.getByLabel('Municipality', { exact: true }).selectOption({ label: 'Labo' })
      await page.getByLabel('Situation type').selectOption({ label: 'Flood' })
      await page.getByLabel('Current condition').selectOption({ label: 'Flooding' })
      await page.getByLabel('Share situation update').fill('Water is rising near the bridge.')

      await expect(page.getByRole('button', { name: 'Post update' })).toBeDisabled()
      await expect(
        page.getByText('Reconnect to post. Saved on this phone until posted.'),
      ).toBeVisible()
      await page.getByRole('button', { name: 'Close' }).click()
      await page.getByRole('button', { name: 'Share local update' }).click()
      await expect(page.getByLabel('Share situation update')).toHaveValue(
        'Water is rising near the bridge.',
      )

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
    } finally {
      await page.context().setOffline(false)
    }
  })
})

test.describe('Citizen PWA accessibility evidence', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('supports keyboard skip navigation and mobile touch targets', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await gotoCitizen(page, '/')

    await expect
      .poll(() => page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches))
      .toBe(true)

    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#main-content')

    const mainNavigation = page.getByRole('navigation', { name: 'Main navigation' })
    for (const label of ['Map', 'Feed', 'Report', 'Alerts', 'Profile']) {
      await expectTouchTarget(mainNavigation.getByRole('button', { name: label, exact: true }))
    }

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
  })
})

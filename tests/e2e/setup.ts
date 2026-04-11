/**
 * Global Playwright setup for E2E tests.
 *
 * Runs once before all E2E tests. Grants browser permissions required
 * by the app (geolocation, notifications) so the location-error overlay
 * does not block test interactions.
 */

import { test as setup } from '@playwright/test'

setup('grant browser permissions', async ({ browser }) => {
  const context = await browser.newContext({
    // Grant geolocation so the app does not show the blocking location-error overlay
    permissions: ['geolocation'],
    // Provide a fixed coordinate so the app's reverse-geocoding resolves deterministically
    geolocation: { latitude: 14.1121, longitude: 122.9381 }, // Daet, Camarines Norte
  })
  await context.close()
})

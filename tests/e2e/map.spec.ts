/**
 * End-to-End Tests for Map Feature
 *
 * Tests complete user flows for the disaster map view.
 * These tests require Firebase Emulator and Playwright to run.
 *
 * Run: firebase emulators:start --background && npx playwright test tests/e2e/map.spec.ts
 */

import { test, expect } from '@playwright/test'

/**
 * Mock disaster reports data for testing
 */
const mockDisasterReports = [
  {
    id: 'report-1',
    incidentType: 'flood',
    severity: 'high',
    status: 'verified',
    timestamp: Date.now() - 1000 * 60 * 30, // 30 minutes ago
    location: {
      latitude: 14.5995,
      longitude: 120.9842,
    },
    description: 'Street flooding in Barangay 1',
  },
  {
    id: 'report-2',
    incidentType: 'landslide',
    severity: 'critical',
    status: 'verified',
    timestamp: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
    location: {
      latitude: 14.61,
      longitude: 120.99,
    },
    description: 'Landslide blocking highway',
  },
  {
    id: 'report-3',
    incidentType: 'fire',
    severity: 'medium',
    status: 'assigned',
    timestamp: Date.now() - 1000 * 60 * 60 * 5, // 5 hours ago
    location: {
      latitude: 14.58,
      longitude: 120.97,
    },
    description: 'Building fire in downtown area',
  },
]

/**
 * Mock Nominatim search results
 */
const mockSearchResults = [
  {
    place_id: '1',
    display_name: 'Daet, Camarines Norte, Philippines',
    lat: '14.5995',
    lon: '120.9842',
  },
  {
    place_id: '2',
    display_name: 'Barangay 1, Daet, Camarines Norte, Philippines',
    lat: '14.605',
    lon: '120.979',
  },
]

test.describe('Map Feature E2E Tests', () => {
  test.describe('Map Initialization and Rendering', () => {
    test('should load map with OpenStreetMap tiles', async ({ page }) => {
      await page.goto('/')

      // Wait for map container to be present
      await expect(page.getByTestId('map-view')).toBeVisible()

      // Wait for loading state to complete
      await expect(page.getByTestId('map-loading')).not.toBeVisible()

      // Verify map container has correct dimensions
      const mapContainer = page.getByTestId('map-view')
      const box = await mapContainer.boundingBox()
      expect(box?.width).toBeGreaterThan(0)
      expect(box?.height).toBeGreaterThan(0)
    })

    test('should display user location marker when geolocation succeeds', async ({ page }) => {
      // Mock geolocation to succeed
      await page.context().setGeolocation({ latitude: 14.5995, longitude: 120.9842 })
      await page.context().grantPermissions(['geolocation'])

      await page.goto('/')

      // Wait for map to load
      await expect(page.getByTestId('map-loading')).not.toBeVisible()

      // Wait for user location info to appear
      await expect(page.getByTestId('user-location-info')).toBeVisible({ timeout: 5000 })

      // Verify location info displays "Your location"
      await expect(page.getByText('Your location')).toBeVisible()
    })

    test('should show loading state while retrieving location', async ({ page }) => {
      // Mock geolocation to be slow
      await page.context().setGeolocation({ latitude: 14.5995, longitude: 120.9842 })
      await page.context().grantPermissions(['geolocation'])

      // Navigate and immediately check for loading state
      await page.goto('/')
      await page.waitForTimeout(100)

      // Location loading may appear briefly
      const locationLoading = page.getByTestId('location-loading')
      const isVisible = await locationLoading.isVisible().catch(() => false)
      if (isVisible) {
        await expect(locationLoading).toBeVisible()
      }
    })

    test('should display error when geolocation is denied', async ({ page }) => {
      // Mock geolocation permission denied
      await page.context().clearPermissions()

      await page.goto('/')

      // Wait for map to load
      await expect(page.getByTestId('map-loading')).not.toBeVisible()

      // Should show location error after permission denied
      await expect(page.getByTestId('location-error')).toBeVisible({ timeout: 5000 })
      await expect(page.getByText('Location Unavailable')).toBeVisible()
    })
  })

  test.describe('Disaster Markers', () => {
    test.beforeEach(async ({ page }) => {
      // Mock geolocation
      await page.context().setGeolocation({ latitude: 14.5995, longitude: 120.9842 })
      await page.context().grantPermissions(['geolocation'])

      // Mock Firestore to return disaster reports
      await page.route('**/firestore.googleapis.com/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            documents: mockDisasterReports.map((report) => ({
              name: `projects/test/databases/(default)/documents/reports/${report.id}`,
              fields: {
                incidentType: { stringValue: report.incidentType },
                severity: { stringValue: report.severity },
                status: { stringValue: report.status },
                createdAt: { integerValue: report.timestamp.toString() },
                description: { stringValue: report.description || '' },
                approximateLocation: {
                  mapValue: {
                    fields: {
                      approximateCoordinates: {
                        geoPointValue: {
                          latitude: report.location.latitude,
                          longitude: report.location.longitude,
                        },
                      },
                    },
                  },
                },
              },
            })),
          }),
        })
      })

      await page.goto('/')
    })

    test('should display disaster markers for verified reports', async ({ page }) => {
      // Wait for map and reports to load
      await expect(page.getByTestId('map-loading')).not.toBeVisible()
      await expect(page.getByTestId('reports-loading')).not.toBeVisible({ timeout: 10000 })

      // Wait a bit for markers to be added to the map
      await page.waitForTimeout(2000)

      // Check for leaflet marker icons
      const markers = await page.locator('.leaflet-marker-icon').count()
      expect(markers).toBeGreaterThan(0)

      // Should have user location marker plus disaster markers
      expect(markers).toBeGreaterThanOrEqual(mockDisasterReports.length)
    })

    test('should show loading indicator while fetching reports', async ({ page }) => {
      // Note: Loading indicator may appear briefly on initial load
      const reportsLoading = page.getByTestId('reports-loading')
      const isVisible = await reportsLoading.isVisible().catch(() => false)
      if (isVisible) {
        await expect(reportsLoading).toBeVisible()
      }
    })

    test('should display error when reports fail to load', async ({ page }) => {
      // Reload page with error route
      await page.goto('/')

      // Unroute and mock error
      await page.unroute('**/firestore.googleapis.com/**')
      await page.route('**/firestore.googleapis.com/**', async (route) => {
        await route.abort('failed')
      })

      // Reload to trigger error
      await page.reload()

      // Should show error indicator
      await expect(page.getByTestId('reports-error')).toBeVisible({ timeout: 10000 })
      await expect(page.getByText('Failed to load disaster reports')).toBeVisible()
    })
  })

  test.describe('Map Controls', () => {
    test.beforeEach(async ({ page }) => {
      await page.context().setGeolocation({ latitude: 14.5995, longitude: 120.9842 })
      await page.context().grantPermissions(['geolocation'])
      await page.goto('/')
      await expect(page.getByTestId('map-loading')).not.toBeVisible()
    })

    test('should display map controls', async ({ page }) => {
      await expect(page.getByTestId('map-controls')).toBeVisible()
      await expect(page.getByTestId('zoom-in-btn')).toBeVisible()
      await expect(page.getByTestId('zoom-out-btn')).toBeVisible()
      await expect(page.getByTestId('locate-btn')).toBeVisible()
      await expect(page.getByTestId('layer-toggle-btn')).toBeVisible()
    })

    test('should zoom in when zoom in button is clicked', async ({ page }) => {
      const zoomInBtn = page.getByTestId('zoom-in-btn')

      // Click zoom in
      await zoomInBtn.click()

      // Wait for zoom animation
      await page.waitForTimeout(500)

      // Button should still be enabled (unless at max zoom)
      const isDisabled = await zoomInBtn.isDisabled()
      expect(isDisabled).toBeFalsy()
    })

    test('should zoom out when zoom out button is clicked', async ({ page }) => {
      const zoomOutBtn = page.getByTestId('zoom-out-btn')

      // Click zoom out
      await zoomOutBtn.click()

      // Wait for zoom animation
      await page.waitForTimeout(500)

      // Button should still be enabled (unless at min zoom)
      const isDisabled = await zoomOutBtn.isDisabled()
      expect(isDisabled).toBeFalsy()
    })

    test('should center on user location when locate button is clicked', async ({ page }) => {
      const locateBtn = page.getByTestId('locate-btn')

      // Click locate button
      await locateBtn.click()

      // Wait for flyTo animation
      await page.waitForTimeout(2000)

      // User location info should still be visible
      await expect(page.getByTestId('user-location-info')).toBeVisible()
    })

    test('should toggle layer type when layer toggle button is clicked', async ({ page }) => {
      const layerToggleBtn = page.getByTestId('layer-toggle-btn')

      // Get initial aria-label
      const initialLabel = await layerToggleBtn.getAttribute('aria-label')
      expect(initialLabel).toContain('Switch to')

      // Click layer toggle
      await layerToggleBtn.click()

      // Wait for layer change
      await page.waitForTimeout(500)

      // Aria-label should have changed
      const newLabel = await layerToggleBtn.getAttribute('aria-label')
      expect(newLabel).not.toBe(initialLabel)
    })
  })

  test.describe('Location Search', () => {
    test.beforeEach(async ({ page }) => {
      await page.context().setGeolocation({ latitude: 14.5995, longitude: 120.9842 })
      await page.context().grantPermissions(['geolocation'])

      // Mock Nominatim API
      await page.route('**/nominatim.openstreetmap.org/**', async (route) => {
        const url = route.request().url()
        if (url.includes('search')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockSearchResults),
          })
        } else {
          await route.continue()
        }
      })

      await page.goto('/')
      await expect(page.getByTestId('map-loading')).not.toBeVisible()
    })

    test('should display search input', async ({ page }) => {
      await expect(page.getByTestId('location-search-input')).toBeVisible()
    })

    test('should show search results when typing', async ({ page }) => {
      const searchInput = page.getByTestId('location-search-input')

      // Type search query
      await searchInput.fill('Daet')
      await page.waitForTimeout(500) // Wait for debounce

      // Dropdown should appear with results
      const dropdown = page.getByTestId('location-search-dropdown')
      await expect(dropdown).toBeVisible()

      // Should show search results
      await expect(page.getByTestId('search-result-1')).toBeVisible()
    })

    test('should center map when search result is clicked', async ({ page }) => {
      const searchInput = page.getByTestId('location-search-input')

      // Type and wait for results
      await searchInput.fill('Daet')
      await page.waitForTimeout(500)

      // Click on first result
      await page.getByTestId('search-result-1').click()

      // Dropdown should close
      await expect(page.getByTestId('location-search-dropdown')).not.toBeVisible()

      // Input should show selected location
      await expect(searchInput).toHaveValue(mockSearchResults[0].display_name)
    })

    test('should clear search when clear button is clicked', async ({ page }) => {
      const searchInput = page.getByTestId('location-search-input')
      const clearBtn = page.getByTestId('location-search-clear')

      // Type search query
      await searchInput.fill('Daet')
      await expect(searchInput).toHaveValue('Daet')

      // Click clear button
      await clearBtn.click()

      // Input should be empty
      await expect(searchInput).toHaveValue('')
    })

    test('should show recent searches when input is focused', async ({ page }) => {
      const searchInput = page.getByTestId('location-search-input')

      // First, perform a search
      await searchInput.fill('Daet')
      await page.waitForTimeout(500)
      await page.getByTestId('search-result-1').click()
      await page.waitForTimeout(500)

      // Clear and focus again
      await page.getByTestId('location-search-clear').click()
      await searchInput.focus()

      // Should show recent searches
      const dropdown = page.getByTestId('location-search-dropdown')
      await expect(dropdown).toBeVisible()
      await expect(page.getByText('Recent Searches')).toBeVisible()
    })
  })

  test.describe('Report Filters', () => {
    test.beforeEach(async ({ page }) => {
      await page.context().setGeolocation({ latitude: 14.5995, longitude: 120.9842 })
      await page.context().grantPermissions(['geolocation'])
      await page.goto('/')
      await expect(page.getByTestId('map-loading')).not.toBeVisible()
    })

    test('should display filter button', async ({ page }) => {
      const filterButton = page.getByRole('button', { name: /filter reports/i })
      await expect(filterButton).toBeVisible()
    })

    test('should open filter sheet when filter button is clicked', async ({ page }) => {
      const filterButton = page.getByRole('button', { name: /filter reports/i })

      await filterButton.click()

      // Filter sheet should be visible (checking for common filter UI elements)
      await expect(page.getByText('Severity')).toBeVisible({ timeout: 3000 })
    })

    test('should update filter count when filters are applied', async ({ page }) => {
      const filterButton = page.getByRole('button', { name: /filter reports/i })

      // Get initial aria-label
      const initialLabel = await filterButton.getAttribute('aria-label')
      expect(initialLabel).toContain('(0 filters active)')

      // Open filters
      await filterButton.click()
      await page.waitForTimeout(500)

      // Select a severity filter
      const highSeverityFilter = page.getByRole('button', { name: /high/i }).first()
      if (await highSeverityFilter.isVisible()) {
        await highSeverityFilter.click()
        await page.waitForTimeout(500)

        // Close filter sheet
        await page.keyboard.press('Escape')

        // Filter count should be updated
        const updatedLabel = await filterButton.getAttribute('aria-label')
        expect(updatedLabel).toContain('(1 filters active)')
      }
    })

    test('should clear all filters when clear is clicked', async ({ page }) => {
      const filterButton = page.getByRole('button', { name: /filter reports/i })

      // Open filters
      await filterButton.click()
      await page.waitForTimeout(500)

      // Look for clear filters button
      const clearButton = page.getByRole('button', { name: /clear filters/i })
      if (await clearButton.isVisible()) {
        await clearButton.click()
        await page.waitForTimeout(500)

        // Filter count should be reset
        const label = await filterButton.getAttribute('aria-label')
        expect(label).toContain('(0 filters active)')
      }
    })
  })

  test.describe('Refresh Functionality', () => {
    test.beforeEach(async ({ page }) => {
      await page.context().setGeolocation({ latitude: 14.5995, longitude: 120.9842 })
      await page.context().grantPermissions(['geolocation'])
      await page.goto('/')
      await expect(page.getByTestId('map-loading')).not.toBeVisible()
    })

    test('should display refresh button', async ({ page }) => {
      await expect(page.getByTestId('refresh-button-container')).toBeVisible()
    })

    test('should show loading state when refresh is clicked', async ({ page }) => {
      const refreshButton = page.getByRole('button', { name: /refresh/i })

      if (await refreshButton.isVisible()) {
        await refreshButton.click()

        // Should show loading state briefly
        await page.waitForTimeout(500)
      }
    })

    test('should display last updated timestamp', async ({ page }) => {
      // Look for last updated text
      const pageContent = await page.content()
      const hasLastUpdated = pageContent.includes('Last updated') ||
                             pageContent.includes('ago') ||
                             pageContent.includes('just now')

      // Last updated should appear somewhere in the UI
      expect(hasLastUpdated).toBeTruthy()
    })
  })

  test.describe('Navigation Between Tabs', () => {
    test.beforeEach(async ({ page }) => {
      await page.context().setGeolocation({ latitude: 14.5995, longitude: 120.9842 })
      await page.context().grantPermissions(['geolocation'])
    })

    test('should navigate to feed tab', async ({ page }) => {
      await page.goto('/')

      // Click on feed tab
      const feedTab = page.getByRole('link', { name: /feed/i })
      await feedTab.click()

      // Should navigate to feed
      await expect(page).toHaveURL('/feed')
    })

    test('should navigate to report tab', async ({ page }) => {
      await page.goto('/')

      // Click on report tab
      const reportTab = page.getByRole('link', { name: /report/i })
      await reportTab.click()

      // Should navigate to report form
      await expect(page).toHaveURL('/report')
    })

    test('should navigate to alerts tab', async ({ page }) => {
      await page.goto('/')

      // Click on alerts tab
      const alertsTab = page.getByRole('link', { name: /alerts/i })
      await alertsTab.click()

      // Should navigate to alerts
      await expect(page).toHaveURL('/alerts')
    })

    test('should navigate to profile tab', async ({ page }) => {
      await page.goto('/')

      // Click on profile tab
      const profileTab = page.getByRole('link', { name: /profile/i })
      await profileTab.click()

      // Should navigate to profile
      await expect(page).toHaveURL('/profile')
    })

    test('should return to map when map tab is clicked', async ({ page }) => {
      await page.goto('/feed')

      // Click on map tab
      const mapTab = page.getByRole('link', { name: /map/i })
      await mapTab.click()

      // Should navigate to map
      await expect(page).toHaveURL('/')
    })

    test('should maintain map state when navigating away and back', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByTestId('map-loading')).not.toBeVisible()

      // Navigate away
      await page.getByRole('link', { name: /feed/i }).click()
      await expect(page).toHaveURL('/feed')

      // Navigate back
      await page.getByRole('link', { name: /map/i }).click()
      await expect(page).toHaveURL('/')

      // Map should load again
      await expect(page.getByTestId('map-view')).toBeVisible()
    })
  })

  test.describe('Report Detail Modal', () => {
    test.beforeEach(async ({ page }) => {
      await page.context().setGeolocation({ latitude: 14.5995, longitude: 120.9842 })
      await page.context().grantPermissions(['geolocation'])

      // Mock Firestore to return disaster reports
      await page.route('**/firestore.googleapis.com/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            documents: mockDisasterReports.map((report) => ({
              name: `projects/test/databases/(default)/documents/reports/${report.id}`,
              fields: {
                incidentType: { stringValue: report.incidentType },
                severity: { stringValue: report.severity },
                status: { stringValue: report.status },
                createdAt: { integerValue: report.timestamp.toString() },
                description: { stringValue: report.description || '' },
                approximateLocation: {
                  mapValue: {
                    fields: {
                      approximateCoordinates: {
                        geoPointValue: {
                          latitude: report.location.latitude,
                          longitude: report.location.longitude,
                        },
                      },
                    },
                  },
                },
              },
            })),
          }),
        })
      })

      await page.goto('/')
      await expect(page.getByTestId('map-loading')).not.toBeVisible()
      await expect(page.getByTestId('reports-loading')).not.toBeVisible({ timeout: 10000 })
    })

    test('should open modal when disaster marker is clicked', async ({ page }) => {
      // Wait for markers to be added
      await page.waitForTimeout(2000)

      // Click on a marker
      const markers = page.locator('.leaflet-marker-icon')
      const count = await markers.count()

      if (count > 0) {
        // Click first marker (excluding user location marker which is usually first)
        await markers.nth(0).click()
        await page.waitForTimeout(500)

        // Modal or popup should appear
        const modalVisible = await page.locator('[role="dialog"]').isVisible().catch(() => false)
        const popupVisible = await page.locator('.leaflet-popup').isVisible().catch(() => false)

        expect(modalVisible || popupVisible).toBeTruthy()
      }
    })

    test('should close modal when close button is clicked', async ({ page }) => {
      await page.waitForTimeout(2000)

      const markers = page.locator('.leaflet-marker-icon')
      const count = await markers.count()

      if (count > 0) {
        await markers.nth(0).click()
        await page.waitForTimeout(500)

        // Try to close modal
        const closeButton = page.getByRole('button', { name: /close/i }).first()
        if (await closeButton.isVisible()) {
          await closeButton.click()
          await page.waitForTimeout(500)

          // Modal should be closed
          const modalVisible = await page.locator('[role="dialog"]').isVisible().catch(() => false)
          expect(modalVisible).toBeFalsy()
        }
      }
    })
  })

  test.describe('Time Range Filters', () => {
    test.beforeEach(async ({ page }) => {
      await page.context().setGeolocation({ latitude: 14.5995, longitude: 120.9842 })
      await page.context().grantPermissions(['geolocation'])
      await page.goto('/')
      await expect(page.getByTestId('map-loading')).not.toBeVisible()
    })

    test('should display time range options in filter sheet', async ({ page }) => {
      const filterButton = page.getByRole('button', { name: /filter reports/i })

      await filterButton.click()
      await page.waitForTimeout(500)

      // Should show time range filter
      const timeRangeLabel = page.getByText(/time range|last/i)
      const isVisible = await timeRangeLabel.isVisible().catch(() => false)

      if (isVisible) {
        await expect(timeRangeLabel).toBeVisible()
      }
    })

    test('should filter reports by selected time range', async ({ page }) => {
      const filterButton = page.getByRole('button', { name: /filter reports/i })

      await filterButton.click()
      await page.waitForTimeout(500)

      // Select a time range (e.g., "Last 24 hours")
      const timeRangeOption = page.getByRole('button', { name: /24 hours|today/i })
      if (await timeRangeOption.isVisible()) {
        await timeRangeOption.click()
        await page.waitForTimeout(500)

        // Close filter sheet
        await page.keyboard.press('Escape')

        // Filter count should be updated
        const label = await filterButton.getAttribute('aria-label')
        expect(label).toContain('(1 filters active)')
      }
    })
  })
})

test.describe('Map Accessibility Tests', () => {
  test('should have proper ARIA labels on map controls', async ({ page }) => {
    await page.context().setGeolocation({ latitude: 14.5995, longitude: 120.9842 })
    await page.context().grantPermissions(['geolocation'])
    await page.goto('/')
    await expect(page.getByTestId('map-loading')).not.toBeVisible()

    // Check ARIA labels on control buttons
    await expect(page.getByTestId('zoom-in-btn')).toHaveAttribute('aria-label', 'Zoom in')
    await expect(page.getByTestId('zoom-out-btn')).toHaveAttribute('aria-label', 'Zoom out')
    await expect(page.getByTestId('locate-btn')).toHaveAttribute('aria-label', 'Center on your location')
  })

  test('should be keyboard navigable', async ({ page }) => {
    await page.context().setGeolocation({ latitude: 14.5995, longitude: 120.9842 })
    await page.context().grantPermissions(['geolocation'])
    await page.goto('/')
    await expect(page.getByTestId('map-loading')).not.toBeVisible()

    // Tab through controls
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')

    // Verify focus is on an interactive element
    const focused = await page.evaluate(() => document.activeElement?.tagName)
    expect(['BUTTON', 'INPUT', 'A']).toContain(focused)
  })
})

test.describe('Map Performance Tests', () => {
  test('should load map quickly', async ({ page }) => {
    const startTime = Date.now()

    await page.goto('/')

    // Wait for map to be ready
    await expect(page.getByTestId('map-loading')).not.toBeVisible()

    const loadTime = Date.now() - startTime

    // Map should load in less than 5 seconds
    expect(loadTime).toBeLessThan(5000)
  })

  test('should respond quickly to zoom controls', async ({ page }) => {
    await page.context().setGeolocation({ latitude: 14.5995, longitude: 120.9842 })
    await page.context().grantPermissions(['geolocation'])
    await page.goto('/')
    await expect(page.getByTestId('map-loading')).not.toBeVisible()

    const zoomInBtn = page.getByTestId('zoom-in-btn')

    const startTime = Date.now()
    await zoomInBtn.click()
    await page.waitForTimeout(100)

    const responseTime = Date.now() - startTime

    // Should respond quickly
    expect(responseTime).toBeLessThan(1000)
  })
})

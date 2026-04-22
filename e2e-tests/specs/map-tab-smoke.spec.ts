import { test, expect } from '@playwright/test'

test.describe('map tab smoke', () => {
  test('renders the shell, map, and filter controls', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('banner')).toContainText('VIGILANT')
    await expect(page.getByRole('navigation', { name: /main navigation/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /map/i })).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('.leaflet-container')).toBeVisible()
    await expect(page.getByRole('button', { name: /severity: all/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /window: 24h/i })).toBeVisible()
  })

  test('navigates through the shell tabs', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: /feed/i }).click()
    await expect(page.getByText(/feed — coming soon/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /feed/i })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})

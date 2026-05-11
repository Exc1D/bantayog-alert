import { test, expect } from '@playwright/test'

const BASE_URL = 'http://localhost:5175'

test.describe('Admin Desktop - Visual Audit (Unauthenticated State)', () => {
  test('Capture current page state', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Capture full page screenshot
    await page.screenshot({
      path: '/Users/superman/dev/projects/bantayog-alert/apps/admin-desktop/e2e/screenshots/current-page-state.png',
      fullPage: true,
    })

    // Get page HTML structure
    const html = await page.evaluate(() => document.body.innerHTML)
    console.log('Page HTML structure:', html.substring(0, 2000))

    // Check what's visible
    const visibleText = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'))
        .filter((el) => {
          const style = window.getComputedStyle(el)
          return style.display !== 'none' && style.visibility !== 'hidden' && el.textContent?.trim()
        })
        .map((el) => ({
          tag: el.tagName,
          text: el.textContent?.trim().substring(0, 100),
          classes: el.className,
        }))
      return elements
    })
    console.log('Visible elements:', JSON.stringify(visibleText, null, 2))
  })

  test('Check for loading states', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('domcontentloaded')

    // Check for any loading indicators
    const hasSpinner = await page
      .locator('.animate-spin')
      .isVisible()
      .catch(() => false)
    const hasLoadingText = await page
      .getByText(/loading|Loading/i)
      .isVisible()
      .catch(() => false)

    console.log('Has spinner:', hasSpinner)
    console.log('Has loading text:', hasLoadingText)

    await page.waitForTimeout(5000)

    // Screenshot after wait
    await page.screenshot({
      path: '/Users/superman/dev/projects/bantayog-alert/apps/admin-desktop/e2e/screenshots/after-wait.png',
      fullPage: true,
    })
  })

  test('Check console for errors', async ({ page }) => {
    const consoleMessages: { type: string; text: string }[] = []
    const pageErrors: string[] = []

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() })
    })

    page.on('pageerror', (err) => {
      pageErrors.push(err.message)
    })

    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(5000)

    console.log('\n=== Console Messages ===')
    consoleMessages.forEach((m) => console.log(`[${m.type}] ${m.text}`))

    console.log('\n=== Page Errors ===')
    pageErrors.forEach((e) => console.log(e))

    // Write to file for analysis
    const fs = await import('fs')
    fs.writeFileSync(
      '/Users/superman/dev/projects/bantayog-alert/apps/admin-desktop/e2e/console-errors.json',
      JSON.stringify({ consoleMessages, pageErrors }, null, 2),
    )
  })
})

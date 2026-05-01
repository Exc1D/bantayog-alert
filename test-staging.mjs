import { chromium } from '@playwright/test'

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
})
const page = await context.newPage()

const errors = []
const warnings = []
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text())
  if (msg.type() === 'warning') warnings.push(msg.text())
})
page.on('pageerror', (err) => errors.push(err.message))

console.log('=== BANTALOG CITIZEN PWA STAGING TEST ===\n')

try {
  await page.goto('https://bantayog-citizen-staging.web.app', { waitUntil: 'load', timeout: 45000 })
  console.log('Title:', await page.title())
} catch (e) {
  console.log('Navigation failed:', e.message)
  await browser.close()
  process.exit(1)
}

await page.waitForTimeout(2000)

// Onboarding flow
const agreeBtn = page.locator('button:has-text("Sang-ayon"), button:has-text("I Agree")').first()
if (await agreeBtn.isVisible().catch(() => false)) {
  await agreeBtn.click({ force: true })
  await page.waitForTimeout(1000)
}

const getStartedBtn = page.locator('button:has-text("Get Started")').first()
if (await getStartedBtn.isVisible().catch(() => false)) {
  await getStartedBtn.click({ force: true })
  await page.waitForTimeout(1000)
}

const checkboxLabel = page.locator('label:has-text("I have read and agree")')
if (await checkboxLabel.isVisible().catch(() => false)) {
  await checkboxLabel.click({ force: true })
  await page.waitForTimeout(500)
  await page.locator('button:has-text("Continue")').first().click({ force: true })
  await page.waitForTimeout(1000)
}

const startReportingBtn = page.locator('button:has-text("Start Reporting")').first()
if (await startReportingBtn.isVisible().catch(() => false)) {
  await startReportingBtn.click({ force: true })
  await page.waitForTimeout(3000)
}

console.log('Feed URL:', page.url())

// === PROFILE TAB TEST ===
console.log('\n=== 1. PROFILE TAB TEST ===')
await page.locator('button:has-text("Profile")').first().click({ force: true })
await page.waitForTimeout(2000)

const profileContent = await page.textContent('body').catch(() => '')
console.log('Profile page content:\n', profileContent.replace(/\s+/g, ' ').substring(0, 500))

// Check for pseudonymous banner
console.log('\nPseudonymous banner check:')
const notRegistered = await page
  .locator('text=/not yet registered/i')
  .isVisible()
  .catch(() => false)
console.log('- "Not yet registered" visible:', notRegistered)

// Check for settings gear
console.log('\nSettings gear check:')
const settingsPatterns = [
  '[aria-label*="Settings"]',
  'button:has-text("Settings")',
  '[class*="gear"]',
  '[class*="setting"]',
]
for (const pattern of settingsPatterns) {
  const el = page.locator(pattern).first()
  const visible = await el.isVisible().catch(() => false)
  if (visible) {
    const text = await el.textContent().catch(() => '')
    const ariaLabel = await el.getAttribute('aria-label').catch(() => '')
    console.log(`- Found: "${text.trim() || ariaLabel}"`)
  }
}

// Get all buttons on profile page
console.log('\nAll buttons on Profile page:')
const profileButtons = await page.locator('button').all()
for (const btn of profileButtons) {
  const text = await btn.textContent().catch(() => '')
  const ariaLabel = await btn.getAttribute('aria-label').catch(() => '')
  const className = await btn.getAttribute('class').catch(() => '')
  console.log(
    `  - "${text.trim()}" aria:${ariaLabel || 'none'} class:${className?.substring(0, 30) || 'none'}`,
  )
}

// === REVEALSHEET TEST ===
console.log('\n=== 2. REVEALSHEET TEST ===')
// Go to Feed
await page.locator('button:has-text("Feed")').first().click({ force: true })
await page.waitForTimeout(2000)

console.log(
  'Feed content:\n',
  (await page.textContent('body')).replace(/\s+/g, ' ').substring(0, 500),
)

// Check if there are incidents
const incidentAlert = page
  .locator('button:has-text("Alert"), [class*="card"]:has-text("Alert")')
  .first()
const alertVisible = await incidentAlert.isVisible().catch(() => false)
console.log('\nAlert card visible:', alertVisible)

// Try clicking anything that might be an incident
if (alertVisible) {
  console.log('Clicking Alert...')
  await incidentAlert.click({ force: true })
  await page.waitForTimeout(5000)

  // Check for RevealSheet
  const dialogs = await page.locator('[role="dialog"]').all()
  console.log('Number of dialogs:', dialogs.length)

  for (const dialog of dialogs) {
    const isVisible = await dialog.isVisible().catch(() => false)
    if (isVisible) {
      const text = await dialog.textContent().catch(() => '')
      console.log('Dialog text:', text.replace(/\s+/g, ' ').substring(0, 400))

      // Check for secret code
      const hasSecretCode = await page
        .locator('text=/secret code|copy secret|copy code/i')
        .isVisible()
        .catch(() => false)
      console.log('Secret code prompt:', hasSecretCode)

      // Check for copy button
      const copyBtn = await page
        .locator('[aria-label*="Copy"], button:has-text("Copy")')
        .first()
        .isVisible()
        .catch(() => false)
      console.log('Copy button:', copyBtn)
    }
  }

  // If no dialog, check what happened
  if (dialogs.length === 0) {
    console.log('No dialog appeared after clicking')
    const currentUrl = page.url()
    console.log('Current URL:', currentUrl)
    const currentContent = await page.textContent('body').catch(() => '')
    console.log('Current content:', currentContent.replace(/\s+/g, ' ').substring(0, 300))
  }
} else {
  // List all clickable elements in feed
  console.log('Looking for incident cards in feed...')
  const feedButtons = await page.locator('[role="button"], button').all()
  console.log(`Found ${feedButtons.length} buttons in feed`)
  for (const btn of feedButtons) {
    const text = await btn.textContent().catch(() => '')
    const className = await btn.getAttribute('class').catch(() => '')
    if (text.trim()) {
      console.log(
        `  Button: "${text.trim().substring(0, 50)}" class: ${className?.substring(0, 40)}`,
      )
    }
  }
}

// === OFFLINE BANNER TEST ===
console.log('\n=== 3. OFFLINE BANNER TEST ===')
// Check if offline banner exists in the shell
const offlineBanner = await page
  .locator('[class*="offline"], [class*="Offline"]')
  .first()
  .isVisible()
  .catch(() => false)
console.log('Offline banner element visible:', offlineBanner)

// Check online status
const onlineStatus = await page.evaluate(() => navigator.onLine)
console.log('Browser online status:', onlineStatus)

// Report errors
console.log('\n=== CONSOLE ERRORS (ERROR level only) ===')
if (errors.length === 0) {
  console.log('No console errors detected')
} else {
  ;[...new Set(errors)].forEach((e) => console.log('ERROR:', e))
}

await browser.close()
console.log('\n=== TEST COMPLETE ===')

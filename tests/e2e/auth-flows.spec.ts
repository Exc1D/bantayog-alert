/**
 * End-to-End Tests for Authentication and Validation
 *
 * Tests complete user flows from UI interactions to database changes.
 * These tests require Firebase Emulator and Playwright to run.
 *
 * Run: firebase emulators:start --background && npx playwright test
 */

import { test, expect } from '@playwright/test'

test.describe('Authentication E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('age_verified', 'true')
    })
    // Navigate to app
    await page.goto('/')
  })

  test.describe('Citizen Registration Flow', () => {
    test('should successfully register a citizen', async ({ page }) => {
      // Navigate to registration
      await page.click('text=Register')
      await page.selectOption('select[name="role"]', 'citizen')

      // Fill registration form
      await page.fill('input[name="email"]', 'citizen@example.com')
      await page.fill('input[name="password"]', 'SecurePass123!')
      await page.fill('input[name="displayName"]', 'Test Citizen')
      await page.fill('input[name="phone"]', '+639123456789') // Optional for citizens

      // Submit
      await page.click('button[type="submit"]')

      // Verify success message
      await expect(page.locator('text=Registration successful')).toBeVisible()

      // Verify email was sent
      await expect(page.locator('text=Please verify your email')).toBeVisible()
    })

    test('should show validation errors for invalid email', async ({ page }) => {
      await page.click('text=Register')
      await page.selectOption('select[name="role"]', 'citizen')

      // Fill with invalid email
      await page.fill('input[name="email"]', 'not-an-email')
      await page.fill('input[name="password"]', 'SecurePass123!')

      // Submit
      await page.click('button[type="submit"]')

      // Verify error message
      await expect(page.locator('text=Please enter a valid email')).toBeVisible()
    })
  })

  test.describe('Responder Registration Flow', () => {
    test('should successfully register a responder with phone verification', async ({ page }) => {
      await page.click('text=Register')
      await page.selectOption('select[name="role"]', 'responder')

      // Fill registration form
      await page.fill('input[name="email"]', 'responder@example.com')
      await page.fill('input[name="password"]', 'SecurePass123!')
      await page.fill('input[name="displayName"]', 'Test Responder')
      await page.fill('input[name="phone"]', '+639123456789') // Required for responders

      // Submit
      await page.click('button[type="submit"]')

      // Should show phone verification step
      await expect(page.locator('text=Phone verification required')).toBeVisible()
      await expect(page.locator('input[name="otp"]')).toBeVisible()
    })

    test('should require phone number for responders', async ({ page }) => {
      await page.click('text=Register')
      await page.selectOption('select[name="role"]', 'responder')

      // Fill without phone number
      await page.fill('input[name="email"]', 'responder@example.com')
      await page.fill('input[name="password"]', 'SecurePass123!')
      await page.fill('input[name="displayName"]', 'Test Responder')
      // Phone number left empty

      // Submit
      await page.click('button[type="submit"]')

      // Verify error
      await expect(page.locator('text=Phone number is required')).toBeVisible()
    })

    test('should reject registration with duplicate phone number', async ({ page }) => {
      // First, register a responder with a phone number
      // (This would be done via a separate API call in a real test)

      await page.click('text=Register')
      await page.selectOption('select[name="role"]', 'responder')

      // Try to register with same phone number
      await page.fill('input[name="email"]', 'responder2@example.com')
      await page.fill('input[name="password"]', 'SecurePass123!')
      await page.fill('input[name="displayName"]', 'Test Responder 2')
      await page.fill('input[name="phone"]', '+639123456789') // Duplicate

      await page.click('button[type="submit"]')

      // Verify error message
      await expect(page.locator('text=Phone number already registered')).toBeVisible()
    })
  })

  test.describe('Municipal Admin Registration Flow', () => {
    test('should successfully register a municipal admin', async ({ page }) => {
      await page.click('text=Register')
      await page.selectOption('select[name="role"]', 'municipal_admin')

      // Fill form
      await page.fill('input[name="email"]', 'admin@daet.gov.ph')
      await page.fill('input[name="password"]', 'SecurePass123!')
      await page.fill('input[name="displayName"]', 'Daet Admin')

      // Select municipality (from dropdown)
      await page.selectOption('select[name="municipality"]', 'municipality-daet')

      // Submit
      await page.click('button[type="submit"]')

      // Verify success
      await expect(page.locator('text=Registration successful')).toBeVisible()
    })

    test('should reject registration with invalid municipality', async ({ page }) => {
      // Note: This test assumes municipalities are loaded from API
      await page.click('text=Register')
      await page.selectOption('select[name="role"]', 'municipal_admin')

      await page.fill('input[name="email"]', 'admin@test.gov.ph')
      await page.fill('input[name="password"]', 'SecurePass123!')
      await page.fill('input[name="displayName"]', 'Test Admin')

      // Try to select non-existent municipality (if dropdown allows custom input)
      // Or test that dropdown doesn't contain invalid option

      await page.click('button[type="submit"]')

      // Verify error
      await expect(page.locator('text=Municipality does not exist')).toBeVisible()
    })
  })

  test.describe('Provincial Superadmin Registration Flow', () => {
    test('should require MFA enrollment for superadmins', async ({ page }) => {
      await page.click('text=Register')
      await page.selectOption('select[name="role"]', 'provincial_superadmin')

      await page.fill('input[name="email"]', 'superadmin@test.gov.ph')
      await page.fill('input[name="password"]', 'SecurePass123!')
      await page.fill('input[name="displayName"]', 'Super Admin')

      await page.click('button[type="submit"]')

      // Should redirect to MFA enrollment page
      await expect(page.locator('text=MFA Enrollment Required')).toBeVisible()
      await expect(page.locator('text=Scan QR code with authenticator app')).toBeVisible()
    })

    test('should show MFA setup instructions', async ({ page }) => {
      await page.click('text=Register')
      await page.selectOption('select[name="role"]', 'provincial_superadmin')

      // Fill and submit
      await page.fill('input[name="email"]', 'superadmin@test.gov.ph')
      await page.fill('input[name="password"]', 'SecurePass123!')
      await page.fill('input[name="displayName"]', 'Super Admin')
      await page.click('button[type="submit"]')

      // Verify MFA instructions are shown
      await expect(page.locator('text=Google Authenticator')).toBeVisible()
      await expect(page.locator('text=Authy')).toBeVisible()
    })
  })
})

test.describe('Login Flow E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('age_verified', 'true')
    })
    await page.goto('/')
    await page.click('text=Login')
  })

  test('should successfully login as citizen', async ({ page }) => {
    await page.selectOption('select[name="role"]', 'citizen')
    await page.fill('input[name="email"]', 'citizen@example.com')
    await page.fill('input[name="password"]', 'SecurePass123!')

    await page.click('button[type="submit"]')

    // Verify redirect to dashboard
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('text=Welcome, Citizen')).toBeVisible()
  })

  test('should block responder login without phone verification', async ({ page }) => {
    await page.selectOption('select[name="role"]', 'responder')
    await page.fill('input[name="email"]', 'responder@example.com')
    await page.fill('input[name="password"]', 'SecurePass123!')

    await page.click('button[type="submit"]')

    // Verify error
    await expect(page.locator('text=Phone verification required')).toBeVisible()
    await expect(page.locator('text=Please complete phone verification')).toBeVisible()
  })

  test('should block superadmin login without MFA', async ({ page }) => {
    await page.selectOption('select[name="role"]', 'provincial_superadmin')
    await page.fill('input[name="email"]', 'superadmin@example.com')
    await page.fill('input[name="password"]', 'SecurePass123!')

    await page.click('button[type="submit"]')

    // Verify error
    await expect(page.locator('text=MFA enrollment required')).toBeVisible()
  })
})

test.describe('Incident Management E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('age_verified', 'true')
    })
    // Login as municipal admin
    await page.goto('/login')
    await page.selectOption('select[name="role"]', 'municipal_admin')
    await page.fill('input[name="email"]', 'admin@daet.gov.ph')
    await page.fill('input[name="password"]', 'SecurePass123!')
    await page.click('button[type="submit"]')
  })

  test('should prevent cross-municipality responder assignment', async ({ page }) => {
    // Navigate to incident details
    await page.goto('/incidents/incident-001')

    // Try to assign responder from different municipality
    await page.click('text=Assign Responder')
    await page.selectOption('select[name="responder"]', 'responder-basud-001')

    await page.click('button[type="submit"]')

    // Verify error message
    await expect(
      page.locator('text=Cannot assign responder from different municipality')
    ).toBeVisible()
    await expect(page.locator('text=Cross-municipality assignment not allowed')).toBeVisible()
  })

  test('should allow same-municipality assignment', async ({ page }) => {
    await page.goto('/incidents/incident-002')

    // Assign responder from same municipality
    await page.click('text=Assign Responder')
    await page.selectOption('select[name="responder"]', 'responder-daet-001')

    await page.click('button[type="submit"]')

    // Verify success
    await expect(page.locator('text=Responder assigned successfully')).toBeVisible()
    await expect(page.locator('text=Assigned to Responder Daet-001')).toBeVisible()
  })
})

test.describe('Error Handling E2E Tests', () => {
  test('should show user-friendly error messages', async ({ page }) => {
    await page.goto('/register')

    // Try to submit empty form
    await page.click('button[type="submit"]')

    // Check for multiple error messages
    await expect(page.locator('text=Email is required')).toBeVisible()
    await expect(page.locator('text=Password is required')).toBeVisible()
  })

  test('should handle network errors gracefully', async ({ page }) => {
    // Mock network failure
    await page.context().setOffline(true)

    await page.goto('/login')
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'password123')
    await page.click('button[type="submit"]')

    // Verify network error message
    await expect(page.locator('text=Network error')).toBeVisible()
    await expect(page.locator('text=Please check your connection')).toBeVisible()

    // Restore connection
    await page.context().setOffline(false)
  })

  test('should provide recovery suggestions', async ({ page }) => {
    await page.goto('/register')
    await page.selectOption('select[name="role"]', 'responder')

    // Try to register with existing phone
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'SecurePass123!')
    await page.fill('input[name="displayName"]', 'Test')
    await page.fill('input[name="phone"]', '+639123456789') // Existing
    await page.click('button[type="submit"]')

    // Verify error includes recovery suggestion
    await expect(page.locator('text=contact administrator')).toBeVisible()
    await expect(page.locator('text=use a different phone number')).toBeVisible()
  })
})

test.describe('Accessibility E2E Tests', () => {
  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/register')

    // Test tab navigation
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')

    // Verify focus moves through form fields
    const focused = await page.evaluate(() => document.activeElement?.tagName)
    expect(focused).toBe('INPUT')
  })

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/register')

    // Check for ARIA labels on form fields
    const emailInput = page.locator('input[name="email"]')
    await expect(emailInput).toHaveAttribute('aria-label')

    const passwordInput = page.locator('input[name="password"]')
    await expect(passwordInput).toHaveAttribute('type', 'password')
  })

  test('should announce errors to screen readers', async ({ page }) => {
    await page.goto('/register')

    // Trigger validation error
    await page.click('button[type="submit"]')

    // Check for role="alert" on error messages
    const errorMessage = page.locator('[role="alert"]')
    await expect(errorMessage).toBeVisible()
  })
})

test.describe('Performance E2E Tests', () => {
  test('should load registration page quickly', async ({ page }) => {
    const startTime = Date.now()

    await page.goto('/register')
    await page.waitForLoadState('networkidle')

    const loadTime = Date.now() - startTime

    // Page should load in less than 3 seconds
    expect(loadTime).toBeLessThan(3000)
  })

  test('should respond quickly to form submissions', async ({ page }) => {
    await page.goto('/register')
    await page.selectOption('select[name="role"]', 'citizen')

    // Fill form quickly
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'SecurePass123!')

    const startTime = Date.now()
    await page.click('button[type="submit"]')

    // Wait for response
    await page.waitForSelector('text=success', { timeout: 5000 })
    const responseTime = Date.now() - startTime

    // Should respond in less than 2 seconds
    expect(responseTime).toBeLessThan(2000)
  })
})

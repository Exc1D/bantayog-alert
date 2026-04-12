/**
 * Accessibility Testing Configuration
 *
 * Provides WCAG 2.1 AA compliance testing using @axe-core/playwright.
 * Configure rules and run accessibility checks on pages.
 */

import { test, expect, Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// WCAG 2.1 AA rules - actual axe-core rule IDs
export const A11Y_RULES = [
  'color-contrast',
  'aria-required-attr',
  'button-name',
  'document-title',
  'heading-order',
  'image-alt',
  'label',
  'link-name',
]

export interface A11yViolation {
  id: string
  description: string
  help: string
  helpUrl: string
  nodes: Array<{
    html: string
    target: string[]
  }>
}

export async function checkA11y(page: Page, context = 'page'): Promise<void> {
  const accessibilityScanResults = await new AxeBuilder({ page })
    .withRules(A11Y_RULES)
    .analyze()

  if (accessibilityScanResults.violations.length > 0) {
    const violationList = accessibilityScanResults.violations.map((v) => ({
      id: v.id,
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
    }))
    console.error(`${context} accessibility violations:`, violationList)
  }

  expect(accessibilityScanResults.violations).toEqual([])
}

export { test, expect }
export type { Page }

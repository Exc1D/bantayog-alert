/**
 * Utility for reading CSS custom properties (design tokens) from :root
 * Used in tests to verify token values are defined correctly.
 *
 * Note: Happy-DOM doesn't fully parse CSS custom properties from imported stylesheets.
 * This function reads the actual CSS file content to validate tokens are defined.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const cssFilePath = path.resolve(__dirname, '../design-tokens.css')

/**
 * Parse CSS custom properties from the design-tokens.css file
 * @returns Record of CSS custom property names to their values
 */
export function readDesignTokens(): Record<string, string> {
  const cssContent = fs.readFileSync(cssFilePath, 'utf-8')
  const tokens: Record<string, string> = {}

  // Match CSS custom properties: --hsu-*: value;
  // Handles both single-line and multi-line definitions
  const tokenRegex = /--hsu-[a-z0-9-]+\s*:\s*([^;]+);/g
  let match

  while ((match = tokenRegex.exec(cssContent)) !== null) {
    const fullMatch = match[0]
    const value = match[1].trim()
    const propName = fullMatch.split(':')[0].trim()

    tokens[propName] = value
  }

  return tokens
}

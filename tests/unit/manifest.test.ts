/**
 * PWA Manifest Unit Tests
 *
 * Validates the Progressive Web App manifest configuration.
 * Tests ensure the manifest file exists, is valid JSON, and contains required fields.
 *
 * Run: npm test -- tests/unit/manifest.test.ts
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const MANIFEST_PATH = join(process.cwd(), 'public/manifest.json')

describe('PWA Manifest', () => {
  describe('File Structure', () => {
    it('should have a manifest file', () => {
      expect(existsSync(MANIFEST_PATH)).toBe(true)
    })

    it('should be valid JSON', () => {
      const content = readFileSync(MANIFEST_PATH, 'utf-8')
      expect(() => JSON.parse(content)).not.toThrow()
    })
  })

  describe('Required Fields', () => {
    let manifest: Record<string, unknown>

    beforeEach(() => {
      const content = readFileSync(MANIFEST_PATH, 'utf-8')
      manifest = JSON.parse(content)
    })

    it('should have app name "Bantayog Alert"', () => {
      expect(manifest.name).toBe('Bantayog Alert')
    })

    it('should have short name "Bantayog"', () => {
      expect(manifest.short_name).toBe('Bantayog')
    })

    it('should have description "Disaster reporting for Camarines Norte"', () => {
      expect(manifest.description).toBe('Disaster reporting for Camarines Norte')
    })

    it('should have theme color #1e40af (primary blue)', () => {
      expect(manifest.theme_color).toBe('#1e40af')
    })

    it('should have background color #ffffff', () => {
      expect(manifest.background_color).toBe('#ffffff')
    })

    it('should have display mode "standalone"', () => {
      expect(manifest.display).toBe('standalone')
    })

    it('should have orientation "portrait"', () => {
      expect(manifest.orientation).toBe('portrait')
    })

    it('should have start_url "/"', () => {
      expect(manifest.start_url).toBe('/')
    })

    it('should have scope "/"', () => {
      expect(manifest.scope).toBe('/')
    })
  })

  describe('Icons Configuration', () => {
    let manifest: { icons: Array<{ src: string; sizes: string; type: string; purpose?: string }> }

    beforeEach(() => {
      const content = readFileSync(MANIFEST_PATH, 'utf-8')
      manifest = JSON.parse(content)
    })

    it('should have an icons array', () => {
      expect(Array.isArray(manifest.icons)).toBe(true)
      expect(manifest.icons.length).toBeGreaterThan(0)
    })

    it('should include all required icon sizes', () => {
      const sizes = manifest.icons.map((icon) => icon.sizes)
      const requiredSizes = ['72x72', '96x96', '128x128', '144x144', '152x152', '192x192', '384x384', '512x512']

      requiredSizes.forEach((size) => {
        expect(sizes).toContain(size)
      })
    })

    it('should have icons with PNG type', () => {
      manifest.icons.forEach((icon) => {
        expect(icon.type).toBe('image/png')
      })
    })

    it('should have icon src paths', () => {
      manifest.icons.forEach((icon) => {
        expect(icon.src).toMatch(/^\/icons\/icon-\d+x\d+\.png$/)
      })
    })

    it('should have purpose attribute on larger icons', () => {
      const largeIcons = manifest.icons.filter((icon) => {
        const size = parseInt(icon.sizes.split('x')[0])
        return size >= 192
      })

      largeIcons.forEach((icon) => {
        expect(icon.purpose).toBeDefined()
        expect(['any', 'maskable', 'any maskable']).toContain(icon.purpose)
      })
    })
  })

  describe('PWA Best Practices', () => {
    let manifest: Record<string, unknown>

    beforeEach(() => {
      const content = readFileSync(MANIFEST_PATH, 'utf-8')
      manifest = JSON.parse(content)
    })

    it('should use standalone display for app-like experience', () => {
      expect(manifest.display).toBe('standalone')
    })

    it('should have portrait orientation for mobile-first design', () => {
      expect(manifest.orientation).toBe('portrait')
    })

    it('should have matching theme and background colors', () => {
      expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i)
      expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i)
    })

    it('should start at root scope', () => {
      expect(manifest.start_url).toBe('/')
      expect(manifest.scope).toBe('/')
    })
  })
})

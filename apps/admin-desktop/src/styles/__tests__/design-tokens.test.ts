/**
 * Tests for HSU v1.2 design tokens
 * Verifies that all required tokens are defined with correct values
 */
import { readDesignTokens } from './readDesignTokens'

describe('Design Tokens', () => {
  describe('HSU v1.2 tokens', () => {
    it('should define critical row background tint', () => {
      const tokens = readDesignTokens()
      expect(tokens['--hsu-crit-tint']).toBe('rgba(239, 68, 68, 0.25)')
    })

    it('should define critical modal background tint', () => {
      const tokens = readDesignTokens()
      expect(tokens['--hsu-crit-modal-bg']).toBe('rgba(239, 68, 68, 0.08)')
    })

    it('should define stale data opacity', () => {
      const tokens = readDesignTokens()
      expect(tokens['--hsu-stale-opacity']).toBe('0.7')
    })

    it('should define room-scale typography - page heading', () => {
      const tokens = readDesignTokens()
      expect(tokens['--hsu-page-heading']).toBe('52px')
    })

    it('should define room-scale typography - section heading', () => {
      const tokens = readDesignTokens()
      expect(tokens['--hsu-section-heading']).toBe('40px')
    })

    it('should define room-scale typography - hero value', () => {
      const tokens = readDesignTokens()
      expect(tokens['--hsu-hero-value']).toBe('64px')
    })

    it('should define room-scale typography - data value', () => {
      const tokens = readDesignTokens()
      expect(tokens['--hsu-data-value']).toBe('32px')
    })

    it('should define room-scale typography - body text', () => {
      const tokens = readDesignTokens()
      expect(tokens['--hsu-body-text']).toBe('18px')
    })

    it('should define room-scale typography - label', () => {
      const tokens = readDesignTokens()
      expect(tokens['--hsu-label']).toBe('16px')
    })

    it('should define spacing scale', () => {
      const tokens = readDesignTokens()
      expect(tokens['--hsu-spacing-micro']).toBe('4px')
      expect(tokens['--hsu-spacing-xs']).toBe('8px')
      expect(tokens['--hsu-spacing-sm']).toBe('12px')
      expect(tokens['--hsu-spacing-md']).toBe('16px')
      expect(tokens['--hsu-spacing-lg']).toBe('24px')
      expect(tokens['--hsu-spacing-xl']).toBe('32px')
      expect(tokens['--hsu-spacing-2xl']).toBe('48px')
    })

    it('should define panel width and transition', () => {
      const tokens = readDesignTokens()
      expect(tokens['--hsu-panel-width']).toBe('450px')
      expect(tokens['--hsu-panel-transition']).toBe('200ms cubic-bezier(0.4, 0, 0.2, 1)')
    })
  })

  describe('Base tokens (existing)', () => {
    it('should define canvas color', () => {
      const tokens = readDesignTokens()
      expect(tokens['--hsu-canvas']).toBe('#0a0f1e')
    })

    it('should define surface colors', () => {
      const tokens = readDesignTokens()
      expect(tokens['--hsu-surface-1']).toBe('#131b30')
      expect(tokens['--hsu-surface-2']).toBe('#1c2642')
      expect(tokens['--hsu-surface-3']).toBe('#263256')
    })

    it('should define border color', () => {
      const tokens = readDesignTokens()
      expect(tokens['--hsu-border']).toBe('#3b4b7a')
    })

    it('should define semantic signal colors', () => {
      const tokens = readDesignTokens()
      expect(tokens['--hsu-crit']).toBe('#ef4444')
      expect(tokens['--hsu-warn']).toBe('#f59e0b')
      expect(tokens['--hsu-norm']).toBe('#10b981')
      expect(tokens['--hsu-info']).toBe('#3b82f6')
    })

    it('should define typography fonts', () => {
      const tokens = readDesignTokens()
      expect(tokens['--hsu-font-primary']).toBe(`'Inter', system-ui, sans-serif`)
      expect(tokens['--hsu-font-telemetry']).toBe(`'JetBrains Mono', monospace`)
    })
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('main stylesheet imports', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>'
  })

  it('imports design tokens before globals', async () => {
    const importOrder: string[] = []
    const renderRoot = vi.fn()

    vi.resetModules()
    vi.doMock('./styles/design-tokens.css', () => {
      importOrder.push('design-tokens.css')
      return {}
    })
    vi.doMock('./styles/globals.css', () => {
      importOrder.push('globals.css')
      return {}
    })
    vi.doMock('react-dom/client', () => ({
      createRoot: () => ({ render: renderRoot }),
    }))
    vi.doMock('./App.js', () => ({
      default: () => null,
    }))

    await import('./main')

    expect(importOrder).toEqual(['globals.css', 'design-tokens.css'])
    expect(renderRoot).toHaveBeenCalled()
  })
})

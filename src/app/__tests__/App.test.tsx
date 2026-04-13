import React from 'react'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { App } from '../App'

// Mock beforeinstallprompt event (matchMedia and localStorage are now in setup.ts)
Object.defineProperty(window, 'beforeinstallprompt', {
  value: vi.fn(),
  writable: true,
})

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  describe('Router Integration', () => {
    it('should render router and navigation', () => {
      render(<App />)

      // Verify that navigation is rendered (indicates router is working)
      expect(screen.getByTestId('navigation')).toBeInTheDocument()
    })
  })

  describe('QueryClient Integration', () => {
    it('should render QueryClientProvider wrapper', () => {
      const { container } = render(<App />)

      const queryProvider = container.querySelector('[data-testid="query-client-provider"]')
      expect(queryProvider).toBeInTheDocument()
    })
  })

  describe('Component Structure', () => {
    it('should render without errors', () => {
      expect(() => render(<App />)).not.toThrow()
    })

    it('should have QueryClientProvider wrapper', () => {
      const { container } = render(<App />)

      // QueryClientProvider wrapper should be present
      const queryProvider = container.querySelector('[data-testid="query-client-provider"]')
      expect(queryProvider).toBeInTheDocument()
    })

    it('should render navigation through router', () => {
      render(<App />)

      // This verifies the entire stack: QueryClientProvider -> RouterProvider -> Navigation
      expect(screen.getByTestId('navigation')).toBeInTheDocument()
    })
  })

  describe('PWAInstallBanner', () => {
    it('should not render banner when beforeinstallprompt has not fired', () => {
      render(<App />)
      expect(screen.queryByTestId('pwa-install-banner')).not.toBeInTheDocument()
    })

    it('should render banner when beforeinstallprompt event fires', async () => {
      render(<App />)

      act(() => {
        window.dispatchEvent(new Event('beforeinstallprompt'))
      })

      await waitFor(() => {
        expect(screen.getByTestId('pwa-install-banner')).toBeInTheDocument()
      })
    })

    it('should have Install button in banner', async () => {
      render(<App />)

      act(() => {
        window.dispatchEvent(new Event('beforeinstallprompt'))
      })

      await waitFor(() => {
        expect(screen.getByTestId('pwa-install-button')).toBeInTheDocument()
      })
    })

    it('should have Dismiss button in banner', async () => {
      render(<App />)

      act(() => {
        window.dispatchEvent(new Event('beforeinstallprompt'))
      })

      await waitFor(() => {
        expect(screen.getByTestId('pwa-dismiss-button')).toBeInTheDocument()
      })
    })

    it('dismiss button should set localStorage and hide banner', async () => {
      const user = userEvent.setup()
      render(<App />)

      act(() => {
        window.dispatchEvent(new Event('beforeinstallprompt'))
      })

      await waitFor(() => {
        expect(screen.getByTestId('pwa-install-banner')).toBeInTheDocument()
      })

      await user.click(screen.getByTestId('pwa-dismiss-button'))

      await waitFor(() => {
        expect(screen.queryByTestId('pwa-install-banner')).not.toBeInTheDocument()
      })
      // localStorage.setItem is now mocked in setup.ts
      expect(localStorage.setItem).toHaveBeenCalledWith('pwa_install_dismissed', 'true')
    })

    it('should not render banner if user previously dismissed (localStorage)', async () => {
      // Pre-populate localStorage via the shared mock
      localStorage.setItem('pwa_install_dismissed', 'true')

      render(<App />)

      act(() => {
        window.dispatchEvent(new Event('beforeinstallprompt'))
      })

      await waitFor(() => {
        expect(screen.queryByTestId('pwa-install-banner')).not.toBeInTheDocument()
      })
    })
  })
})

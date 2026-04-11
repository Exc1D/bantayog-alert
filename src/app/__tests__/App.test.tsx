import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { App } from '../App'

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock localStorage
Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
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
})

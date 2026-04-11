import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { App } from '../App'

describe('App Component', () => {
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

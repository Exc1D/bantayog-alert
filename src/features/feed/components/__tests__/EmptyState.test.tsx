/**
 * EmptyState Component Tests
 *
 * Tests the empty state component that displays when there are no reports.
 */

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { EmptyState } from '../EmptyState'

// Helper to render with router
const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <MemoryRouter>
      {component}
    </MemoryRouter>
  )
}

describe('EmptyState', () => {
  it('should render the empty state container', () => {
    renderWithRouter(<EmptyState />)

    expect(screen.getByTestId('feed-empty-state')).toBeInTheDocument()
  })

  it('should display the illustration icon', () => {
    renderWithRouter(<EmptyState />)

    const iconContainer = screen.getByTestId('empty-state-icon')
    expect(iconContainer).toBeInTheDocument()
    expect(iconContainer).toHaveClass('w-24', 'h-24', 'bg-gray-100', 'rounded-full')
  })

  it('should display the main title', () => {
    renderWithRouter(<EmptyState />)

    const title = screen.getByTestId('empty-state-title')
    expect(title).toBeInTheDocument()
    expect(title.textContent).toBe('No reports yet')
  })

  it('should display the description message', () => {
    renderWithRouter(<EmptyState />)

    const description = screen.getByTestId('empty-state-description')
    expect(description).toBeInTheDocument()
    expect(description.textContent).toBe('Be the first to report an incident in your area!')
  })

  it('should render the call-to-action button', () => {
    renderWithRouter(<EmptyState />)

    const button = screen.getByTestId('empty-state-cta-button')
    expect(button).toBeInTheDocument()
    expect(button.textContent).toBe('Report Incident')
  })

  it('should link to the report page', () => {
    renderWithRouter(<EmptyState />)

    const link = screen.getByTestId('empty-state-cta-link')
    expect(link).toBeInTheDocument()
    expect(link.getAttribute('href')).toBe('/report')
  })

  it('should have proper CSS classes for layout', () => {
    renderWithRouter(<EmptyState />)

    const emptyState = screen.getByTestId('feed-empty-state')
    expect(emptyState).toHaveClass('flex', 'flex-col', 'items-center', 'justify-center')
  })

  it('should have mobile-first responsive spacing', () => {
    renderWithRouter(<EmptyState />)

    const emptyState = screen.getByTestId('feed-empty-state')
    expect(emptyState).toHaveClass('py-16', 'px-4')
  })

  it('should have proper button variant', () => {
    renderWithRouter(<EmptyState />)

    const button = screen.getByTestId('empty-state-cta-button')
    expect(button).toHaveClass('bg-primary-blue')
  })

  it('should be accessible with proper semantic structure', () => {
    renderWithRouter(<EmptyState />)

    // Check that heading level is correct
    const title = screen.getByRole('heading', { level: 2 })
    expect(title).toBeInTheDocument()

    // Check that button is focusable
    const button = screen.getByRole('button', { name: 'Report Incident' })
    expect(button).toBeInTheDocument()
  })
})

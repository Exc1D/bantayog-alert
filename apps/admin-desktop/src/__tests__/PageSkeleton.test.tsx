import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageSkeleton } from '../components/PageSkeleton'

describe('PageSkeleton', () => {
  it('renders a skeleton layout with header, status bar, and content areas', () => {
    render(<PageSkeleton variant="dashboard" />)

    // Should have a header placeholder
    expect(screen.getByRole('status', { name: /loading dashboard/i })).toBeInTheDocument()

    // Should have multiple skeleton content blocks (not just one spinner)
    const skeletonBlocks = screen.getAllByTestId('skeleton-block')
    expect(skeletonBlocks.length).toBeGreaterThan(3)

    // Should NOT have a spinner
    expect(document.querySelector('.animate-spin')).not.toBeInTheDocument()
  })

  it('renders map variant with fewer blocks', () => {
    render(<PageSkeleton variant="map" />)

    const skeletonBlocks = screen.getAllByTestId('skeleton-block')
    expect(skeletonBlocks.length).toBeGreaterThan(1)
    expect(skeletonBlocks.length).toBeLessThan(6)
  })

  it('renders feed variant with list-shaped blocks', () => {
    render(<PageSkeleton variant="feed" />)

    const skeletonBlocks = screen.getAllByTestId('skeleton-block')
    expect(skeletonBlocks.length).toBeGreaterThan(2)
  })

  it('has aria-live polite so screen readers announce loading', () => {
    render(<PageSkeleton variant="dashboard" />)

    const region = screen.getByRole('status')
    expect(region).toHaveAttribute('aria-live', 'polite')
  })
})

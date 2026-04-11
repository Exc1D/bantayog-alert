/**
 * FeedCardSkeleton Component Tests
 *
 * Tests the loading skeleton component.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FeedCardSkeleton } from '../FeedCardSkeleton'

describe('FeedCardSkeleton', () => {
  it('should render skeleton structure', () => {
    render(<FeedCardSkeleton />)

    expect(screen.getByTestId('feed-card-skeleton')).toBeInTheDocument()
  })

  it('should have correct CSS classes for animation', () => {
    const { container } = render(<FeedCardSkeleton />)

    const skeleton = container.querySelector('[data-testid="feed-card-skeleton"]')
    expect(skeleton).toHaveClass('animate-pulse')
  })

  it('should match report card structure', () => {
    const { container } = render(<FeedCardSkeleton />)

    // Check for rounded container
    const skeleton = container.querySelector('[data-testid="feed-card-skeleton"]')
    expect(skeleton).toHaveClass('rounded-lg', 'p-4')

    // Check for header, content, and footer sections
    const children = skeleton?.children
    expect(children).toHaveLength(3) // Header, content, footer
  })
})

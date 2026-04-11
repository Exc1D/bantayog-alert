/**
 * UpdateTimeline Component Tests
 *
 * Tests the timeline component for report status updates.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UpdateTimeline } from '../UpdateTimeline'

const mockTimeline = [
  {
    id: '1',
    timestamp: new Date(Date.now() - 3600000),
    type: 'submitted' as const,
    description: 'Report submitted',
  },
  {
    id: '2',
    timestamp: new Date(Date.now() - 1800000),
    type: 'verified' as const,
    description: 'Verified by admin',
    actor: 'Admin User',
  },
  {
    id: '3',
    timestamp: new Date(Date.now() - 900000),
    type: 'dispatched' as const,
    description: 'Responders dispatched',
  },
]

describe('UpdateTimeline', () => {
  it('should render all timeline entries', () => {
    render(<UpdateTimeline entries={mockTimeline} />)

    expect(screen.getByText('Report submitted')).toBeInTheDocument()
    expect(screen.getByText('Verified by admin')).toBeInTheDocument()
    expect(screen.getByText('Responders dispatched')).toBeInTheDocument()
  })

  it('should show icons for each timeline type', () => {
    render(<UpdateTimeline entries={mockTimeline} />)

    // Should have 3 timeline items with data-testid
    const items = screen.getAllByTestId(/timeline-item-/)
    expect(items.length).toBe(3)
  })

  it('should display timestamps in relative format', () => {
    render(<UpdateTimeline entries={mockTimeline} />)

    expect(screen.getByText(/\d+h ago/)).toBeInTheDocument()
  })

  it('should render empty state when no entries', () => {
    render(<UpdateTimeline entries={[]} />)

    expect(screen.getByText(/no updates yet/i)).toBeInTheDocument()
  })

  it('should display actor when provided', () => {
    render(<UpdateTimeline entries={mockTimeline} />)

    expect(screen.getByText('Admin User')).toBeInTheDocument()
  })

  it('should mark last entry as Latest', () => {
    render(<UpdateTimeline entries={mockTimeline} />)

    expect(screen.getByText('Latest')).toBeInTheDocument()
  })

  it('should render different timeline types with correct icons', () => {
    const entries = [
      { id: '1', timestamp: new Date(), type: 'submitted' as const, description: 'Submitted' },
      { id: '2', timestamp: new Date(), type: 'verified' as const, description: 'Verified' },
      { id: '3', timestamp: new Date(), type: 'resolved' as const, description: 'Resolved' },
      { id: '4', timestamp: new Date(), type: 'comment' as const, description: 'Comment' },
    ]

    render(<UpdateTimeline entries={entries} />)

    expect(screen.getByText('Submitted')).toBeInTheDocument()
    expect(screen.getByText('Verified')).toBeInTheDocument()
    expect(screen.getByText('Resolved')).toBeInTheDocument()
    expect(screen.getByText('Comment')).toBeInTheDocument()
  })
})

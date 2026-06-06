import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResponderAvailabilityPanel } from '../components/ResponderAvailabilityPanel'
import type { ResponderFleetMember } from '../hooks/useResponderFleet'

const mockResponders: ResponderFleetMember[] = [
  {
    uid: 'r1',
    displayName: 'Santos',
    availabilityStatus: 'available',
    lastActivityAt: Date.now(),
    onlineStatus: 'online',
  },
  {
    uid: 'r2',
    displayName: 'Reyes',
    availabilityStatus: 'available',
    lastActivityAt: Date.now() - 10 * 60 * 1000,
    onlineStatus: 'away',
  },
  {
    uid: 'r3',
    displayName: 'Cruz',
    availabilityStatus: 'unavailable',
    lastActivityAt: Date.now() - 60 * 60 * 1000,
    onlineStatus: 'offline',
  },
]

describe('ResponderAvailabilityPanel', () => {
  it('shows empty state when no responders', () => {
    render(<ResponderAvailabilityPanel responders={[]} />)
    expect(screen.getByText('No responders online')).toBeInTheDocument()
  })

  it('renders header with responder count', () => {
    render(<ResponderAvailabilityPanel responders={mockResponders} />)
    expect(screen.getByText('Responders (3)')).toBeInTheDocument()
  })

  it('shows the responder account creation action when wired', () => {
    render(
      <ResponderAvailabilityPanel
        responders={mockResponders}
        onCreateResponder={() => Promise.resolve()}
      />,
    )
    expect(screen.getByRole('button', { name: /create responder account/i })).toBeInTheDocument()
  })

  it('renders display names for each responder', () => {
    render(<ResponderAvailabilityPanel responders={mockResponders} />)
    expect(screen.getByText('Santos')).toBeInTheDocument()
    expect(screen.getByText('Reyes')).toBeInTheDocument()
    expect(screen.getByText('Cruz')).toBeInTheDocument()
  })

  it('renders online status labels for each responder', () => {
    render(<ResponderAvailabilityPanel responders={mockResponders} />)
    expect(screen.getByText('online')).toBeInTheDocument()
    expect(screen.getByText('away')).toBeInTheDocument()
    expect(screen.getByText('offline')).toBeInTheDocument()
  })

  it('renders green dot for online status', () => {
    const { container } = render(<ResponderAvailabilityPanel responders={[mockResponders[0]!]} />)
    const dot = container.querySelector('.bg-green-500')
    expect(dot).not.toBeNull()
  })

  it('renders amber dot for away status', () => {
    const { container } = render(<ResponderAvailabilityPanel responders={[mockResponders[1]!]} />)
    const dot = container.querySelector('.bg-amber-500')
    expect(dot).not.toBeNull()
  })

  it('renders gray dot for offline status', () => {
    const { container } = render(<ResponderAvailabilityPanel responders={[mockResponders[2]!]} />)
    const dot = container.querySelector('.bg-gray-500')
    expect(dot).not.toBeNull()
  })

  it('wraps list in scrollable container', () => {
    const { container } = render(<ResponderAvailabilityPanel responders={mockResponders} />)
    const scrollable = container.querySelector('.max-h-64.overflow-y-auto')
    expect(scrollable).not.toBeNull()
  })
})

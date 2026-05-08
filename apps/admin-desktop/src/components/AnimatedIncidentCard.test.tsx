import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { AnimatedIncidentCard } from '../components/AnimatedIncidentCard'
import { useReducedMotion } from '../hooks/useReducedMotion'

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => (
      <div data-testid="motion-div" {...props}>
        {children}
      </div>
    ),
  },
}))

// Mock useReducedMotion
vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: vi.fn(() => false),
}))

const mockIncident = {
  id: 'inc-1',
  location: { lat: 14.1, lng: 122.8 },
  severity: 'critical' as const,
  type: 'Flood',
  municipality: 'Daet',
  timestamp: new Date('2026-05-08T14:30:00Z'),
  status: 'active',
}

describe('AnimatedIncidentCard', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders incident type', () => {
    render(<AnimatedIncidentCard incident={mockIncident} index={0} />)
    expect(screen.getByText('Flood')).toBeInTheDocument()
  })

  it('renders municipality name', () => {
    render(<AnimatedIncidentCard incident={mockIncident} index={0} />)
    expect(screen.getByText(new RegExp('Daet'))).toBeInTheDocument()
  })

  it('uses motion wrapper when animations enabled', () => {
    render(<AnimatedIncidentCard incident={mockIncident} index={0} />)
    expect(screen.getByTestId('motion-div')).toBeInTheDocument()
  })

  it('shows severity border color', () => {
    render(<AnimatedIncidentCard incident={mockIncident} index={0} />)
    const card = screen.getByTestId('incident-card')
    expect(card).toHaveStyle({ borderLeftColor: '#a73400' })
  })

  it('shows different severity colors', () => {
    const { rerender } = render(
      <AnimatedIncidentCard incident={{ ...mockIncident, severity: 'high' as const }} index={0} />,
    )

    let card = screen.getByTestId('incident-card')
    expect(card).toHaveStyle({ borderLeftColor: '#c77600' })

    rerender(
      <AnimatedIncidentCard
        incident={{ ...mockIncident, severity: 'medium' as const }}
        index={0}
      />,
    )

    card = screen.getByTestId('incident-card')
    expect(card).toHaveStyle({ borderLeftColor: '#2d6a4f' })
  })

  it('has left border width for visual emphasis', () => {
    render(<AnimatedIncidentCard incident={mockIncident} index={0} />)
    const card = screen.getByTestId('incident-card')
    expect(card).toHaveStyle({ borderLeftWidth: '4px' })
  })
})

describe('AnimatedIncidentCard with reduced motion', () => {
  it('renders without motion wrapper when reduced motion preferred', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true)

    render(<AnimatedIncidentCard incident={mockIncident} index={0} />)
    expect(screen.queryByTestId('motion-div')).not.toBeInTheDocument()

    vi.mocked(useReducedMotion).mockReturnValue(false)
  })
})

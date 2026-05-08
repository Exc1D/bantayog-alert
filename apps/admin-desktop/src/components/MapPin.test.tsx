import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MapPin } from '../components/MapPin'

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => (
      <div data-testid="motion-div" {...props}>
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock useReducedMotion
vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}))

describe('MapPin', () => {
  const mockIncident = {
    id: 'inc-1',
    location: { lat: 14.1, lng: 122.8 },
    severity: 'critical' as const,
    type: 'Flood',
    municipality: 'Daet',
  }

  afterEach(() => {
    cleanup()
  })

  it('renders incident type', () => {
    render(<MapPin incident={mockIncident} />)
    expect(screen.getByText('Flood')).toBeInTheDocument()
  })

  it('renders municipality name', () => {
    render(<MapPin incident={mockIncident} />)
    expect(screen.getByText('Daet')).toBeInTheDocument()
  })

  it('shows severity color for critical', () => {
    render(<MapPin incident={mockIncident} />)
    const pin = screen.getByTestId('map-pin')
    expect(pin).toHaveStyle({ backgroundColor: '#a73400' })
  })

  it('shows severity color for high', () => {
    render(<MapPin incident={{ ...mockIncident, severity: 'high' as const }} />)
    const pin = screen.getByTestId('map-pin')
    expect(pin).toHaveStyle({ backgroundColor: '#c77600' })
  })

  it('shows severity color for medium', () => {
    render(<MapPin incident={{ ...mockIncident, severity: 'medium' as const }} />)
    const pin = screen.getByTestId('map-pin')
    expect(pin).toHaveStyle({ backgroundColor: '#2d6a4f' })
  })

  it('shows severity color for low', () => {
    render(<MapPin incident={{ ...mockIncident, severity: 'low' as const }} />)
    const pin = screen.getByTestId('map-pin')
    expect(pin).toHaveStyle({ backgroundColor: '#6c757d' })
  })

  it('has animation wrapper when motion is enabled', () => {
    render(<MapPin incident={mockIncident} />)
    expect(screen.getByTestId('motion-div')).toBeInTheDocument()
  })
})

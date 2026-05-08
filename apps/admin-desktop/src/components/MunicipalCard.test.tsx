import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MunicipalCard } from '../components/MunicipalCard'

const noop = vi.fn()

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
  useReducedMotion: () => false,
}))

describe('MunicipalCard', () => {
  const mockMunicipality = {
    name: 'Daet',
    activeIncidents: 5,
    avgResponseTimeMinutes: 12,
    status: 'slow' as const,
  }

  afterEach(() => {
    cleanup()
  })

  it('renders municipality name', () => {
    render(<MunicipalCard municipality={mockMunicipality} onClick={noop} isAnimating={false} />)
    expect(screen.getByText('Daet')).toBeInTheDocument()
  })

  it('renders active incident count', () => {
    render(<MunicipalCard municipality={mockMunicipality} onClick={noop} isAnimating={false} />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('shows slow status text', () => {
    render(<MunicipalCard municipality={mockMunicipality} onClick={noop} isAnimating={false} />)
    expect(screen.getByText('Slow')).toBeInTheDocument()
  })

  it('shows delayed status text', () => {
    render(
      <MunicipalCard
        municipality={{ ...mockMunicipality, status: 'delayed' as const }}
        onClick={noop}
        isAnimating={false}
      />,
    )
    expect(screen.getByText('Delayed')).toBeInTheDocument()
  })

  it('shows responsive status text', () => {
    render(
      <MunicipalCard
        municipality={{ ...mockMunicipality, status: 'responsive' as const }}
        onClick={noop}
        isAnimating={false}
      />,
    )
    expect(screen.getByText('Responsive')).toBeInTheDocument()
  })

  it('has animation class when isAnimating is true', () => {
    render(<MunicipalCard municipality={mockMunicipality} onClick={noop} isAnimating={true} />)
    const card = screen.getByTestId('municipal-card')
    expect(card).toHaveAttribute('data-animating', 'true')
  })

  it('does not have animation class when isAnimating is false', () => {
    render(<MunicipalCard municipality={mockMunicipality} onClick={noop} isAnimating={false} />)
    const card = screen.getByTestId('municipal-card')
    expect(card).toHaveAttribute('data-animating', 'false')
  })

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn()
    render(
      <MunicipalCard municipality={mockMunicipality} onClick={handleClick} isAnimating={false} />,
    )
    const card = screen.getByTestId('municipal-card')
    card.click()
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CommandHeader } from '../components/CommandHeader'

describe('CommandHeader', () => {
  it('renders title and live indicator', () => {
    render(<CommandHeader title="PDRRMO Camarines Norte" lastUpdatedAt={Date.now()} />)
    expect(screen.getByText('PDRRMO Camarines Norte')).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('opens map window when clicked', async () => {
    const user = userEvent.setup()
    const onOpenMap = vi.fn()
    render(<CommandHeader title="Test" lastUpdatedAt={Date.now()} onOpenMap={onOpenMap} />)
    await user.click(screen.getByRole('button', { name: /open map/i }))
    expect(onOpenMap).toHaveBeenCalled()
  })

  it('shows a Dashboard role chip and danger-toned accent when windowRole is "dashboard"', () => {
    const { container } = render(
      <CommandHeader
        title="PDRRMO Camarines Norte"
        lastUpdatedAt={Date.now()}
        windowRole="dashboard"
      />,
    )
    const chip = screen.getByTestId('window-role-chip')
    expect(chip).toHaveTextContent(/dashboard/i)
    // Visually distinct accent — keyed to the dashboard role (danger token).
    const accent = container.querySelector('[data-testid="window-role-accent"]')
    expect(accent).not.toBeNull()
    expect(accent?.getAttribute('data-role')).toBe('dashboard')
  })

  it('shows a Map role chip and info-toned accent when windowRole is "map"', () => {
    const { container } = render(
      <CommandHeader
        title="Provincial Map — Camarines Norte"
        lastUpdatedAt={Date.now()}
        windowRole="map"
      />,
    )
    const chip = screen.getByTestId('window-role-chip')
    expect(chip).toHaveTextContent(/map/i)
    const accent = container.querySelector('[data-testid="window-role-accent"]')
    expect(accent).not.toBeNull()
    expect(accent?.getAttribute('data-role')).toBe('map')
  })

  it('renders without role chip or accent when windowRole is not provided', () => {
    render(<CommandHeader title="Generic" lastUpdatedAt={Date.now()} />)
    expect(screen.queryByTestId('window-role-chip')).not.toBeInTheDocument()
    expect(screen.queryByTestId('window-role-accent')).not.toBeInTheDocument()
  })
})

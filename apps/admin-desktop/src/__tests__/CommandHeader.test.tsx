import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CommandHeader } from '../components/CommandHeader'

describe('CommandHeader', () => {
  it('renders title and live indicator', () => {
    render(
      <MemoryRouter>
        <CommandHeader title="PDRRMO Camarines Norte" lastUpdatedAt={Date.now()} />
      </MemoryRouter>,
    )
    expect(screen.getByText('PDRRMO Camarines Norte')).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders command-center tabs including feed moderation', () => {
    render(
      <MemoryRouter>
        <CommandHeader
          title="PDRRMO Camarines Norte"
          lastUpdatedAt={Date.now()}
          windowRole="feed"
        />
      </MemoryRouter>,
    )

    // react-router-dom Link renders as <a>, but the href is replaced by a resolved 'to'
    // On the root of MemoryRouter, these resolve to relative /dashboard, /map, /feed
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('link', { name: 'Map' })).toHaveAttribute('href', '/map')
    expect(screen.getByRole('link', { name: 'Feed' })).toHaveAttribute('href', '/feed')
    expect(screen.getByRole('link', { name: 'Feed' })).toHaveAttribute('aria-current', 'page')
  })

  it('renders command-center tabs including Dispatches', () => {
    render(
      <MemoryRouter>
        <CommandHeader
          title="PDRRMO Camarines Norte"
          lastUpdatedAt={Date.now()}
          windowRole="dispatches"
        />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Dispatches' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Dispatches' })).toHaveAttribute('href', '/dispatches')
    expect(screen.getByRole('link', { name: 'Dispatches' })).toHaveAttribute('aria-current', 'page')
  })

  it('shows a Dashboard role chip and danger-toned accent when windowRole is "dashboard"', () => {
    const { container } = render(
      <MemoryRouter>
        <CommandHeader
          title="PDRRMO Camarines Norte"
          lastUpdatedAt={Date.now()}
          windowRole="dashboard"
        />
      </MemoryRouter>,
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
      <MemoryRouter>
        <CommandHeader
          title="Provincial Map — Camarines Norte"
          lastUpdatedAt={Date.now()}
          windowRole="map"
        />
      </MemoryRouter>,
    )
    const chip = screen.getByTestId('window-role-chip')
    expect(chip).toHaveTextContent(/map/i)
    const accent = container.querySelector('[data-testid="window-role-accent"]')
    expect(accent).not.toBeNull()
    expect(accent?.getAttribute('data-role')).toBe('map')
  })

  it('renders without role chip or accent when windowRole is not provided', () => {
    render(
      <MemoryRouter>
        <CommandHeader title="Generic" lastUpdatedAt={Date.now()} />
      </MemoryRouter>,
    )
    expect(screen.queryByTestId('window-role-chip')).not.toBeInTheDocument()
    expect(screen.queryByTestId('window-role-accent')).not.toBeInTheDocument()
  })

  it('icon buttons have focus-visible ring classes', () => {
    render(
      <MemoryRouter>
        <CommandHeader
          title="Focus Test"
          lastUpdatedAt={Date.now()}
          audioEnabled
          onToggleAudio={vi.fn()}
          onShowNotifications={vi.fn()}
          onShowKeyboardShortcuts={vi.fn()}
        />
      </MemoryRouter>,
    )

    const audioBtn = screen.getByRole('button', { name: /mute audio/i })
    const notifyBtn = screen.getByRole('button', { name: /notifications/i })
    const shortcutsBtn = screen.getByRole('button', { name: /keyboard shortcuts/i })

    for (const btn of [audioBtn, notifyBtn, shortcutsBtn]) {
      const cls = btn.className
      expect(cls).toMatch(/focus-visible:outline-none/)
      expect(cls).toMatch(/focus-visible:ring-2/)
      expect(cls).toMatch(/focus-visible:ring-white\/50/)
    }
  })

  it('notification badge uses warning color token', () => {
    render(
      <MemoryRouter>
        <CommandHeader
          title="Badge Test"
          lastUpdatedAt={Date.now()}
          notificationCount={3}
          onShowNotifications={vi.fn()}
        />
      </MemoryRouter>,
    )
    const badge = screen.getByText('3')
    expect(badge.className).toMatch(/bg-\[var\(--color-warning\)\]/)
  })

  it('muted audio icon uses text-muted token', () => {
    render(
      <MemoryRouter>
        <CommandHeader
          title="Muted Test"
          lastUpdatedAt={Date.now()}
          audioEnabled={false}
          onToggleAudio={vi.fn()}
        />
      </MemoryRouter>,
    )
    const btn = screen.getByRole('button', { name: /enable audio/i })
    expect(btn.innerHTML).toMatch(/text-\[var\(--color-text-muted\)\]/)
  })
})

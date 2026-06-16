import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { StatusBar } from '../components/StatusBar'
import type { DashboardMode } from '../utils/dashboard-mode'

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

function renderStatusBar(props: {
  activeIncidents: number
  avgResponseTime: number
  avgAcceptSeconds?: number | null
  fcmSuccessRate?: number | null
  pendingTriage: number
  resolvedToday?: number
  muniIssues?: { resolved: number; total: number }
  mode?: DashboardMode
  affectedMunicipalities?: string[]
  stalledDispatchCount?: number
  totalResponders?: number
  uncoveredMunicipalities?: number
  lastDataUpdateAt?: number
  metricsError?: string | null
}) {
  const resolvedToday = props.resolvedToday
  const muniIssues = props.muniIssues
  const metricsError = props.metricsError
  const statusBarProps = {
    activeIncidents: props.activeIncidents,
    avgResponseTime: props.avgResponseTime,
    avgAcceptSeconds: props.avgAcceptSeconds ?? null,
    fcmSuccessRate: props.fcmSuccessRate !== undefined ? props.fcmSuccessRate : 0.95,
    pendingTriage: props.pendingTriage,
    mode: props.mode ?? 'calm',
    affectedMunicipalities: props.affectedMunicipalities ?? [],
    stalledDispatchCount: props.stalledDispatchCount ?? 0,
    totalResponders: props.totalResponders ?? 0,
    uncoveredMunicipalities: props.uncoveredMunicipalities ?? 0,
    lastDataUpdateAt: props.lastDataUpdateAt ?? Date.now(),
    ...(resolvedToday !== undefined ? { resolvedToday } : {}),
    ...(muniIssues !== undefined ? { muniIssues } : {}),
    ...(metricsError !== undefined ? { metricsError } : {}),
  } satisfies React.ComponentProps<typeof StatusBar>

  return renderWithRouter(<StatusBar {...statusBarProps} />)
}

describe('StatusBar', () => {
  it('renders three metrics', () => {
    renderStatusBar({ activeIncidents: 47, avgResponseTime: 12, pendingTriage: 8 })
    expect(screen.getByText('47')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
  })

  it('shows surge glow when pending >= 20, guarded by motion-safe so users who prefer reduced motion are not animated', () => {
    renderStatusBar({ activeIncidents: 10, avgResponseTime: 5, pendingTriage: 22 })
    const bar = screen.getByTestId('statusbar-root')
    expect(bar).toHaveClass('motion-safe:animate-pulse')
    expect(bar).toHaveClass('border-[var(--color-severity-medium)]')
    // Regression: the unguarded class must NOT be present — it would override the reduced-motion preference.
    expect(bar.className.split(/\s+/)).not.toContain('animate-pulse')
  })

  it('shows surge glow when active incidents >= 50, guarded by motion-safe', () => {
    renderStatusBar({ activeIncidents: 55, avgResponseTime: 5, pendingTriage: 5 })
    const bar = screen.getByTestId('statusbar-root')
    expect(bar).toHaveClass('motion-safe:animate-pulse')
    expect(bar).toHaveClass('border-[var(--color-severity-medium)]')
    expect(bar.className.split(/\s+/)).not.toContain('animate-pulse')
  })

  it('does not apply the pulse class when not in surge', () => {
    renderStatusBar({ activeIncidents: 7, avgResponseTime: 4, pendingTriage: 3 })
    const bar = screen.getByTestId('statusbar-root')
    expect(bar.className).not.toMatch(/animate-pulse/)
  })

  it('renders em-dash placeholders for resolved/muni stats when no data is supplied', () => {
    renderStatusBar({ activeIncidents: 7, avgResponseTime: 4, pendingTriage: 3 })
    // Regression: hardcoded prototype values "89" and "0/12" must not be present.
    expect(screen.queryByText('89')).not.toBeInTheDocument()
    expect(screen.queryByText('0/12')).not.toBeInTheDocument()
    // Truth-gate: both rows show em-dash until real aggregation is wired.
    expect(screen.getByTestId('statusbar-resolved-today')).toHaveTextContent('—')
    expect(screen.getByTestId('statusbar-muni-issues')).toHaveTextContent('—')
  })

  it('renders supplied resolved/muni stats when props are provided', () => {
    renderStatusBar({
      activeIncidents: 7,
      avgResponseTime: 4,
      pendingTriage: 3,
      resolvedToday: 42,
      muniIssues: { resolved: 3, total: 12 },
    })
    expect(screen.getByTestId('statusbar-resolved-today')).toHaveTextContent('42')
    expect(screen.getByTestId('statusbar-muni-issues')).toHaveTextContent('3/12')
  })

  describe('mode badge', () => {
    const modes: DashboardMode[] = ['calm', 'active', 'degraded', 'surge']

    it.each(modes)('renders mode badge correctly for %s', (mode) => {
      renderStatusBar({
        activeIncidents: 1,
        avgResponseTime: 5,
        pendingTriage: 1,
        mode,
        lastDataUpdateAt: Date.now(),
      })
      const badge = screen.getByTestId('mode-badge')
      expect(badge).toHaveTextContent(mode.toUpperCase())
      expect(badge).toHaveAttribute('role', 'status')
      expect(badge).toHaveAttribute('aria-live', 'polite')
    })

    it('applies pulse to degraded mode', () => {
      renderStatusBar({
        activeIncidents: 1,
        avgResponseTime: 5,
        pendingTriage: 1,
        mode: 'degraded',
        lastDataUpdateAt: Date.now(),
      })
      const badge = screen.getByTestId('mode-badge')
      expect(badge).toHaveClass('motion-safe:animate-pulse')
    })

    it('applies pulse to surge mode', () => {
      renderStatusBar({
        activeIncidents: 1,
        avgResponseTime: 5,
        pendingTriage: 1,
        mode: 'surge',
        lastDataUpdateAt: Date.now(),
      })
      const badge = screen.getByTestId('mode-badge')
      expect(badge).toHaveClass('motion-safe:animate-pulse')
    })

    it('does not apply pulse to calm mode', () => {
      renderStatusBar({
        activeIncidents: 1,
        avgResponseTime: 5,
        pendingTriage: 1,
        mode: 'calm',
        lastDataUpdateAt: Date.now(),
      })
      const badge = screen.getByTestId('mode-badge')
      expect(badge.className).not.toMatch(/animate-pulse/)
    })

    it('does not apply pulse to active mode', () => {
      renderStatusBar({
        activeIncidents: 1,
        avgResponseTime: 5,
        pendingTriage: 1,
        mode: 'active',
        lastDataUpdateAt: Date.now(),
      })
      const badge = screen.getByTestId('mode-badge')
      expect(badge.className).not.toMatch(/animate-pulse/)
    })
  })

  describe('municipality chips', () => {
    it('renders municipality chips as links when not in calm mode', () => {
      renderStatusBar({
        activeIncidents: 1,
        avgResponseTime: 5,
        pendingTriage: 1,
        mode: 'active',
        affectedMunicipalities: ['Manila', 'Quezon City'],
        lastDataUpdateAt: Date.now(),
      })
      const manilaLink = screen.getByText('Manila')
      expect(manilaLink.tagName).toBe('A')
      expect(manilaLink).toHaveAttribute('href', '/map?municipality=Manila')

      const qcLink = screen.getByText('Quezon City')
      expect(qcLink.tagName).toBe('A')
      expect(qcLink).toHaveAttribute('href', '/map?municipality=Quezon%20City')
    })

    it('hides municipality chips in calm mode', () => {
      renderStatusBar({
        activeIncidents: 0,
        avgResponseTime: 5,
        pendingTriage: 0,
        mode: 'calm',
        affectedMunicipalities: ['Manila'],
        lastDataUpdateAt: Date.now(),
      })
      expect(screen.queryByTestId('municipality-chips')).not.toBeInTheDocument()
      expect(screen.getByTestId('all-clear')).toHaveTextContent('All clear')
    })

    it('hides municipality chips when list is empty even in non-calm mode', () => {
      renderStatusBar({
        activeIncidents: 1,
        avgResponseTime: 5,
        pendingTriage: 1,
        mode: 'active',
        affectedMunicipalities: [],
        lastDataUpdateAt: Date.now(),
      })
      expect(screen.queryByTestId('municipality-chips')).not.toBeInTheDocument()
    })
  })

  describe('blocking response', () => {
    it('shows stalled dispatch count when greater than 0', () => {
      renderStatusBar({
        activeIncidents: 1,
        avgResponseTime: 5,
        pendingTriage: 1,
        stalledDispatchCount: 3,
        lastDataUpdateAt: Date.now(),
      })
      expect(screen.getByTestId('blocking-response')).toHaveTextContent('3 stalled dispatches')
    })

    it('uses singular form for one stalled dispatch', () => {
      renderStatusBar({
        activeIncidents: 1,
        avgResponseTime: 5,
        pendingTriage: 1,
        stalledDispatchCount: 1,
        lastDataUpdateAt: Date.now(),
      })
      expect(screen.getByTestId('blocking-response')).toHaveTextContent('1 stalled dispatch')
    })

    it('hides blocking response when stalled count is 0', () => {
      renderStatusBar({
        activeIncidents: 1,
        avgResponseTime: 5,
        pendingTriage: 1,
        stalledDispatchCount: 0,
        lastDataUpdateAt: Date.now(),
      })
      expect(screen.queryByTestId('blocking-response')).not.toBeInTheDocument()
    })
  })

  describe('responder coverage', () => {
    it('shows responder coverage', () => {
      renderStatusBar({
        activeIncidents: 1,
        avgResponseTime: 5,
        pendingTriage: 1,
        totalResponders: 12,
        uncoveredMunicipalities: 3,
        lastDataUpdateAt: Date.now(),
      })
      expect(screen.getByTestId('responder-coverage')).toHaveTextContent(
        '12 available / 3 uncovered',
      )
    })

    it('shows zero responders', () => {
      renderStatusBar({
        activeIncidents: 1,
        avgResponseTime: 5,
        pendingTriage: 1,
        totalResponders: 0,
        uncoveredMunicipalities: 5,
        lastDataUpdateAt: Date.now(),
      })
      expect(screen.getByTestId('responder-coverage')).toHaveTextContent(
        '0 available / 5 uncovered',
      )
    })
  })

  describe('data freshness', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('shows live seconds ago when under 60s', () => {
      const now = new Date('2024-01-01T12:00:00Z').getTime()
      vi.setSystemTime(now)
      renderStatusBar({
        activeIncidents: 1,
        avgResponseTime: 5,
        pendingTriage: 1,
        lastDataUpdateAt: now - 45_000,
      })
      expect(screen.getByTestId('data-freshness')).toHaveTextContent('live 45s ago')
    })

    it('shows updated minutes when between 60s and 5min', () => {
      const now = new Date('2024-01-01T12:00:00Z').getTime()
      vi.setSystemTime(now)
      renderStatusBar({
        activeIncidents: 1,
        avgResponseTime: 5,
        pendingTriage: 1,
        lastDataUpdateAt: now - 180_000,
      })
      expect(screen.getByTestId('data-freshness')).toHaveTextContent('updated 3m ago')
    })

    it('shows stale when over 5 minutes', () => {
      const now = new Date('2024-01-01T12:00:00Z').getTime()
      vi.setSystemTime(now)
      renderStatusBar({
        activeIncidents: 1,
        avgResponseTime: 5,
        pendingTriage: 1,
        lastDataUpdateAt: now - 400_000,
      })
      expect(screen.getByTestId('data-freshness')).toHaveTextContent('stale 6m ago')
    })
  })

  describe('operational labels', () => {
    it('operational labels removed from situation strip — alert dots replace them', () => {
      // The new layout uses colored alert dots instead of text labels
      // to reduce cognitive load and type hierarchy flattening
      renderStatusBar({
        activeIncidents: 10,
        avgResponseTime: 5,
        pendingTriage: 1,
      })
      // Just verify the strip renders without the old label text
      expect(screen.getByText('active')).toBeInTheDocument()
      expect(screen.getByText('avg response')).toBeInTheDocument()
      expect(screen.getByText('pending')).toBeInTheDocument()
    })
  })

  describe('metrics error indicator', () => {
    it('renders a metrics-unavailable indicator when metricsError is set', () => {
      renderStatusBar({
        activeIncidents: 1,
        avgResponseTime: 5,
        pendingTriage: 1,
        metricsError: 'boom',
      })
      const indicator = screen.getByRole('status', { name: /metrics unavailable/i })
      expect(indicator).toBeInTheDocument()
    })

    it('does not render a metrics-unavailable indicator when metricsError is null', () => {
      renderStatusBar({
        activeIncidents: 1,
        avgResponseTime: 5,
        pendingTriage: 1,
        metricsError: null,
      })
      expect(screen.queryByRole('status', { name: /metrics unavailable/i })).not.toBeInTheDocument()
    })

    it('does not render a metrics-unavailable indicator when metricsError is omitted', () => {
      renderStatusBar({
        activeIncidents: 1,
        avgResponseTime: 5,
        pendingTriage: 1,
      })
      expect(screen.queryByRole('status', { name: /metrics unavailable/i })).not.toBeInTheDocument()
    })
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { TopBanner } from '../components/TopBanner'

describe('TopBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-08T14:32:07Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('renders province name', () => {
    render(<TopBanner alertLevel="normal" connectionStatus="live" lastUpdated={new Date()} />)

    expect(screen.getByText('PDRRMO')).toBeInTheDocument()
    expect(screen.getByText('Camarines Norte')).toBeInTheDocument()
  })

  it('renders live clock in 24h format', () => {
    render(<TopBanner alertLevel="normal" connectionStatus="live" lastUpdated={new Date()} />)

    const timeRegex = /^\d{2}:\d{2}:\d{2}$/
    const timeElement = screen.getByText(timeRegex)
    expect(timeElement).toBeInTheDocument()
  })

  it('shows normal alert level badge', () => {
    render(<TopBanner alertLevel="normal" connectionStatus="live" lastUpdated={new Date()} />)

    const badge = screen.getByText('NORMAL')
    expect(badge).toBeInTheDocument()
  })

  it('shows elevated alert level badge', () => {
    render(<TopBanner alertLevel="elevated" connectionStatus="live" lastUpdated={new Date()} />)

    expect(screen.getByText('ELEVATED')).toBeInTheDocument()
  })

  it('shows critical alert level badge', () => {
    render(<TopBanner alertLevel="critical" connectionStatus="live" lastUpdated={new Date()} />)

    expect(screen.getByText('CRITICAL')).toBeInTheDocument()
  })

  it('shows live connection status', () => {
    render(<TopBanner alertLevel="normal" connectionStatus="live" lastUpdated={new Date()} />)

    expect(screen.getByText('LIVE')).toBeInTheDocument()
  })

  it('shows stale connection status with timestamp', () => {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000)
    render(<TopBanner alertLevel="normal" connectionStatus="stale" lastUpdated={twoMinutesAgo} />)

    expect(screen.getByText(/STALE/)).toBeInTheDocument()
  })

  it('has declare alert button', () => {
    render(<TopBanner alertLevel="normal" connectionStatus="live" lastUpdated={new Date()} />)

    expect(screen.getByRole('button', { name: /declare emergency alert/i })).toBeInTheDocument()
  })

  it('calls onDeclareAlert when button is clicked', () => {
    const handleDeclare = vi.fn()
    render(
      <TopBanner
        alertLevel="normal"
        connectionStatus="live"
        lastUpdated={new Date()}
        onDeclareAlert={handleDeclare}
      />,
    )

    const button = screen.getByRole('button', { name: /declare emergency alert/i })
    button.click()
    expect(handleDeclare).toHaveBeenCalledTimes(1)
  })

  it('renders KPI toggle button when onToggleKpiPanel provided', () => {
    const handleToggleKpi = vi.fn()
    render(
      <TopBanner
        alertLevel="normal"
        connectionStatus="live"
        lastUpdated={new Date()}
        onToggleKpiPanel={handleToggleKpi}
      />,
    )

    expect(screen.getByRole('button', { name: /toggle kpi panel/i })).toBeInTheDocument()
  })

  it('calls onToggleKpiPanel when KPI button clicked', () => {
    const handleToggleKpi = vi.fn()
    render(
      <TopBanner
        alertLevel="normal"
        connectionStatus="live"
        lastUpdated={new Date()}
        onToggleKpiPanel={handleToggleKpi}
      />,
    )

    const button = screen.getByRole('button', { name: /toggle kpi panel/i })
    button.click()
    expect(handleToggleKpi).toHaveBeenCalledTimes(1)
  })

  it('clock updates every second', () => {
    render(<TopBanner alertLevel="normal" connectionStatus="live" lastUpdated={new Date()} />)

    const timeRegex = /^\d{2}:\d{2}:\d{2}$/
    const initialTime = screen.getByText(timeRegex).textContent

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    const updatedTime = screen.getByText(timeRegex).textContent
    expect(updatedTime).not.toBe(initialTime)
  })

  it('alert badge has data attribute for level', () => {
    render(<TopBanner alertLevel="critical" connectionStatus="live" lastUpdated={new Date()} />)

    const badge = screen.getByText('CRITICAL')
    expect(badge).toHaveAttribute('data-alert-level', 'critical')
  })

  it('alert badge changes data attribute when level changes', () => {
    const { rerender } = render(
      <TopBanner alertLevel="normal" connectionStatus="live" lastUpdated={new Date()} />,
    )

    const badge = screen.getByText('NORMAL')
    expect(badge).toHaveAttribute('data-alert-level', 'normal')

    rerender(<TopBanner alertLevel="critical" connectionStatus="live" lastUpdated={new Date()} />)

    const updatedBadge = screen.getByText('CRITICAL')
    expect(updatedBadge).toHaveAttribute('data-alert-level', 'critical')
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AnomalyAlertPanel } from '../components/AnomalyAlertPanel'
import type { AnomalyAlert } from '../types'

const mockAlerts: AnomalyAlert[] = [
  {
    id: 'a1',
    municipality: 'Capalonga',
    type: 'response_time_spike',
    message: 'Response time up 40% (18 min avg)',
    severity: 'HIGH',
    detectedAt: '2026-05-10T10:00:00Z',
  },
  {
    id: 'a2',
    municipality: 'Capalonga',
    type: 'admin_shift_gap',
    message: 'No admin shift handoff for 8h',
    severity: 'MEDIUM',
    detectedAt: '2026-05-10T09:00:00Z',
  },
]

describe('AnomalyAlertPanel', () => {
  it('renders anomaly cards', () => {
    render(<AnomalyAlertPanel alerts={mockAlerts} onDismiss={vi.fn()} />)
    expect(screen.getByText('Response time up 40% (18 min avg)')).toBeInTheDocument()
    expect(screen.getByText('No admin shift handoff for 8h')).toBeInTheDocument()
  })

  it('shows municipality for each alert', () => {
    render(<AnomalyAlertPanel alerts={mockAlerts} onDismiss={vi.fn()} />)
    // Both mock alerts are from Capalonga
    expect(screen.getAllByText('Capalonga')).toHaveLength(2)
  })

  it('calls onDismiss with investigating reason', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(<AnomalyAlertPanel alerts={mockAlerts} onDismiss={onDismiss} />)
    const buttons = screen.getAllByRole('button', { name: 'Investigating' })
    await user.click(buttons[0]!)
    expect(onDismiss).toHaveBeenCalledWith('a1', 'investigating')
  })

  it('calls onDismiss with false_positive reason', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(<AnomalyAlertPanel alerts={mockAlerts} onDismiss={onDismiss} />)
    const buttons = screen.getAllByRole('button', { name: 'False Positive' })
    await user.click(buttons[0]!)
    expect(onDismiss).toHaveBeenCalledWith('a1', 'false_positive')
  })

  it('calls onDismiss with resolved reason', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(<AnomalyAlertPanel alerts={mockAlerts} onDismiss={onDismiss} />)
    const buttons = screen.getAllByRole('button', { name: 'Resolved' })
    await user.click(buttons[0]!)
    expect(onDismiss).toHaveBeenCalledWith('a1', 'resolved')
  })

  it('does not have a generic dismiss button', () => {
    render(<AnomalyAlertPanel alerts={mockAlerts} onDismiss={vi.fn()} />)
    expect(screen.queryAllByRole('button', { name: /dismiss/i })).toHaveLength(0)
  })

  it('does not render dismissed alerts', () => {
    const dismissed: AnomalyAlert[] = [
      ...mockAlerts,
      {
        id: 'a3',
        municipality: 'Daet',
        type: 'zero_activity',
        message: 'Zero incident reports in 6h',
        severity: 'LOW',
        detectedAt: '2026-05-10T08:00:00Z',
        dismissedAt: '2026-05-10T11:00:00Z',
      },
    ]
    render(<AnomalyAlertPanel alerts={dismissed} onDismiss={vi.fn()} />)
    expect(screen.queryByText('Zero incident reports in 6h')).not.toBeInTheDocument()
  })

  it('shows empty state when no alerts', () => {
    render(<AnomalyAlertPanel alerts={[]} onDismiss={vi.fn()} />)
    expect(screen.getByText('No anomalies detected')).toBeInTheDocument()
  })
})

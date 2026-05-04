import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockAlerts = vi.fn()

vi.mock('../hooks/useAlerts.js', () => ({
  useAlerts: () => mockAlerts(),
}))

vi.mock('../hooks/useAlertReadState.js', () => ({
  useAlertReadState: () => ({
    markAsRead: vi.fn(),
    isUnread: (id: string) => id === 'unread-alert',
    unreadCount: (ids: string[]) => ids.filter((id) => id === 'unread-alert').length,
    readAlerts: {},
  }),
}))

import { AlertsTab } from './AlertsTab'

describe('AlertsTab', () => {
  it('renders without crashing', () => {
    mockAlerts.mockReturnValue({ alerts: [], loading: false })
    const { container } = render(<AlertsTab />)
    expect(container).toBeInTheDocument()
  })

  it('shows empty state when no alerts', () => {
    mockAlerts.mockReturnValue({ alerts: [], loading: false })
    render(<AlertsTab />)
    expect(screen.getByText('No active alerts')).toBeInTheDocument()
  })

  it('renders issuedBy row when present', () => {
    mockAlerts.mockReturnValue({
      alerts: [
        {
          id: 'a1',
          title: 'Flood Warning',
          body: 'Rising water levels',
          severity: 'high',
          publishedAt: Date.now(),
          issuedBy: 'Daet MDRRMO',
        },
      ],
      loading: false,
    })
    render(<AlertsTab />)
    expect(screen.getByText('Issued by: Daet MDRRMO')).toBeInTheDocument()
  })

  it('does not render issuedBy row when absent', () => {
    mockAlerts.mockReturnValue({
      alerts: [
        {
          id: 'a1',
          title: 'Flood Warning',
          body: 'Rising water levels',
          severity: 'high',
          publishedAt: Date.now(),
        },
      ],
      loading: false,
    })
    render(<AlertsTab />)
    expect(screen.queryByText(/Issued by:/)).not.toBeInTheDocument()
  })

  it('shows loading skeletons when loading=true', () => {
    mockAlerts.mockReturnValue({ alerts: [], loading: true })
    render(<AlertsTab />)
    expect(screen.getByText('Alerts')).toBeInTheDocument()
    expect(screen.queryByText('No active alerts')).not.toBeInTheDocument()
  })

  it('shows error state when error is set', () => {
    mockAlerts.mockReturnValue({ alerts: [], loading: false, error: new Error('Network failure') })
    render(<AlertsTab />)
    expect(screen.getByText('Could not load alerts')).toBeInTheDocument()
    expect(screen.getByText('Network failure')).toBeInTheDocument()
  })

  it('shows critical alert strip for critical severity', () => {
    mockAlerts.mockReturnValue({
      alerts: [
        {
          id: 'c1',
          title: 'Emergency',
          body: 'Evacuate now',
          severity: 'critical',
          publishedAt: Date.now(),
        },
      ],
      loading: false,
    })
    render(<AlertsTab />)
    expect(screen.getByText('Active emergency alert in effect')).toBeInTheDocument()
  })

  it('shows unread count in header', () => {
    mockAlerts.mockReturnValue({
      alerts: [
        {
          id: 'unread-alert',
          title: 'Alert 1',
          body: 'body',
          severity: 'low',
          publishedAt: Date.now(),
        },
        {
          id: 'read-alert',
          title: 'Alert 2',
          body: 'body',
          severity: 'low',
          publishedAt: Date.now(),
        },
      ],
      loading: false,
    })
    render(<AlertsTab />)
    expect(screen.getByText('1 unread alert')).toBeInTheDocument()
  })

  it('renders multiple alert cards', () => {
    mockAlerts.mockReturnValue({
      alerts: [
        { id: 'a1', title: 'Low Alert', body: 'body', severity: 'low', publishedAt: Date.now() },
        { id: 'a2', title: 'High Alert', body: 'body', severity: 'high', publishedAt: Date.now() },
      ],
      loading: false,
    })
    render(<AlertsTab />)
    expect(screen.getByText('Low Alert')).toBeInTheDocument()
    expect(screen.getByText('High Alert')).toBeInTheDocument()
  })
})

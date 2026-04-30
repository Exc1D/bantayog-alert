/* eslint-disable @typescript-eslint/no-unsafe-return */
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockAlerts = vi.fn()

vi.mock('../hooks/useAlerts.js', () => ({
  useAlerts: () => mockAlerts(),
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
})

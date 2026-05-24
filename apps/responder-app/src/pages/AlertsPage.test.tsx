import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'

const mockUseOfficialAlerts = vi.hoisted(() => vi.fn())

vi.mock('../hooks/useOfficialAlerts', () => ({
  useOfficialAlerts: mockUseOfficialAlerts,
}))

import { AlertsPage } from './AlertsPage'

describe('AlertsPage', () => {
  beforeEach(() => {
    mockUseOfficialAlerts.mockReturnValue({
      alerts: [],
      loading: false,
      error: null,
    })
  })

  it('renders a loading state', () => {
    mockUseOfficialAlerts.mockReturnValue({ alerts: [], loading: true, error: null })

    render(<AlertsPage />)

    expect(screen.getByRole('status')).toHaveTextContent(/loading official alerts/i)
  })

  it('renders an empty state', () => {
    render(<AlertsPage />)

    expect(screen.getByText(/no official alerts/i)).toBeInTheDocument()
  })

  it('renders an error state', () => {
    mockUseOfficialAlerts.mockReturnValue({
      alerts: [],
      loading: false,
      error: 'permission_denied',
    })

    render(<AlertsPage />)

    expect(screen.getByRole('alert')).toHaveTextContent(/could not load official alerts/i)
    expect(screen.getByRole('alert')).toHaveTextContent(/permission_denied/i)
  })

  it('keeps stale alerts visible when a refresh error occurs', () => {
    mockUseOfficialAlerts.mockReturnValue({
      loading: false,
      error: 'permission_denied',
      alerts: [
        {
          id: 'stale-alert-1',
          message: 'Signal no. 3 remains active',
          hazardType: 'typhoon',
          affectedMunicipalityIds: ['daet'],
          declaredAtMillis: Date.now() - 120_000,
          publishedAtMillis: Date.now() - 60_000,
          declaredBy: 'admin-1',
        },
      ],
    })

    render(<AlertsPage />)

    expect(screen.getByRole('alert')).toHaveTextContent(/could not refresh official alerts/i)
    expect(screen.getByRole('alert')).toHaveTextContent(/permission_denied/i)
    expect(screen.getByRole('article', { name: /typhoon alert/i })).toBeInTheDocument()
    expect(screen.getByText(/signal no. 3 remains active/i)).toBeInTheDocument()
  })

  it('renders official alert cards with hazard and concrete scope labels', () => {
    mockUseOfficialAlerts.mockReturnValue({
      loading: false,
      error: null,
      alerts: [
        {
          id: 'alert-1',
          message: 'Signal no. 3 raised',
          hazardType: 'typhoon',
          affectedMunicipalityIds: ['daet', 'mercedes'],
          declaredAtMillis: Date.now() - 120_000,
          publishedAtMillis: Date.now() - 60_000,
          declaredBy: 'admin-1',
        },
      ],
    })

    render(<AlertsPage />)

    expect(screen.getByRole('article', { name: /typhoon alert/i })).toBeInTheDocument()
    expect(screen.getByText(/signal no. 3 raised/i)).toBeInTheDocument()
    expect(screen.getByText(/daet, mercedes/i)).toBeInTheDocument()
    expect(screen.getByText(/declared by admin-1/i)).toBeInTheDocument()
  })

  it('renders province-wide for alerts without a municipality scope', () => {
    mockUseOfficialAlerts.mockReturnValue({
      loading: false,
      error: null,
      alerts: [
        {
          id: 'alert-province',
          message: 'All municipalities should monitor conditions',
          hazardType: 'flood',
          affectedMunicipalityIds: [],
          declaredAtMillis: Date.now() - 120_000,
          publishedAtMillis: Date.now() - 60_000,
          declaredBy: 'admin-1',
        },
      ],
    })

    render(<AlertsPage />)

    expect(screen.getByText(/province-wide/i)).toBeInTheDocument()
  })
})

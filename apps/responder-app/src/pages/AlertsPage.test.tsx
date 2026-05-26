import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'

const mockUseOfficialAlerts = vi.hoisted(() => vi.fn())

vi.mock('../hooks/useOfficialAlerts', () => ({
  useOfficialAlerts: mockUseOfficialAlerts,
}))

import { AlertsPage } from './AlertsPage'

const mockRetry = vi.fn()

describe('AlertsPage', () => {
  beforeEach(() => {
    mockRetry.mockClear()
    mockUseOfficialAlerts.mockReturnValue({
      alerts: [],
      loading: false,
      error: null,
      retry: mockRetry,
    })
  })

  it('renders a loading state', () => {
    mockUseOfficialAlerts.mockReturnValue({
      alerts: [],
      loading: true,
      error: null,
      retry: mockRetry,
    })

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
      retry: mockRetry,
    })

    render(<AlertsPage />)

    expect(screen.getByRole('alert')).toHaveTextContent(/could not load official alerts/i)
    expect(screen.getByRole('alert')).toHaveTextContent(/permission_denied/i)
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('calls retry when retry button is clicked', () => {
    mockUseOfficialAlerts.mockReturnValue({
      alerts: [],
      loading: false,
      error: 'network_error',
      retry: mockRetry,
    })

    render(<AlertsPage />)

    const retryBtn = screen.getByRole('button', { name: /retry/i })
    retryBtn.click()
    expect(mockRetry).toHaveBeenCalledTimes(1)
  })

  it('keeps stale alerts visible when a refresh error occurs', () => {
    mockUseOfficialAlerts.mockReturnValue({
      loading: false,
      error: 'permission_denied',
      retry: mockRetry,
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
      retry: mockRetry,
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
      retry: mockRetry,
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

  it('clamps long alert messages with a Show more button', () => {
    mockUseOfficialAlerts.mockReturnValue({
      loading: false,
      error: null,
      retry: mockRetry,
      alerts: [
        {
          id: 'alert-long',
          message:
            'A massive landslide has blocked the main highway connecting multiple barangays. The debris field extends over two hundred meters and has caused significant damage to nearby structures. Several families have been evacuated and emergency responders are on the scene assessing the structural integrity of surrounding buildings. The area remains unstable and further landslides are possible during continued rainfall. Motorists are advised to take alternate routes and avoid the region entirely.',
          hazardType: 'flood',
          affectedMunicipalityIds: ['daet'],
          declaredAtMillis: Date.now(),
          publishedAtMillis: Date.now(),
          declaredBy: '',
        },
      ],
    })

    render(<AlertsPage />)

    expect(screen.getByText(/debris field extends/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /show full alert message/i })).toBeInTheDocument()
  })
})

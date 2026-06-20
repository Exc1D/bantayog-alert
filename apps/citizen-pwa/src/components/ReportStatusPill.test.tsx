import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockUseMyActiveReports = vi.fn()
vi.mock('../hooks/useMyActiveReports.js', () => ({
  useMyActiveReports: () => mockUseMyActiveReports(),
}))

vi.mock('../utils/incident-meta.js', () => ({
  incidentLabel: (type: string) => type,
}))

vi.mock('../hooks/useReducedMotion.js', () => ({
  useReducedMotion: () => false,
}))

import { ReportStatusPill } from './ReportStatusPill'

function renderPill() {
  return render(
    <MemoryRouter>
      <ReportStatusPill />
    </MemoryRouter>,
  )
}

const storage = new Map<string, string>()

beforeEach(() => {
  mockNavigate.mockReset()
  mockUseMyActiveReports.mockReset()
  storage.clear()
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
      removeItem: (key: string) => {
        storage.delete(key)
      },
    },
    writable: true,
  })
})

const baseReport = {
  publicRef: 'a1b2c3d4',
  reportType: 'flood',
  severity: 'high',
  lat: 14.11,
  lng: 122.95,
  submittedAt: 1713350400000,
  status: 'awaiting_verify',
  municipalityLabel: 'Daet',
}

describe('ReportStatusPill', () => {
  it('renders nothing when no active reports', () => {
    mockUseMyActiveReports.mockReturnValue({ reports: [], loading: false })
    renderPill()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders collapsed bell icon for single active report', () => {
    mockUseMyActiveReports.mockReturnValue({ reports: [baseReport], loading: false })
    renderPill()
    const btn = screen.getByRole('button')
    expect(btn).toBeInTheDocument()
    // Initially collapsed — shows bell icon, not full text
    expect(screen.queryByText(/flood/i)).not.toBeInTheDocument()
  })

  it('expands on first tap to show report details', () => {
    mockUseMyActiveReports.mockReturnValue({ reports: [baseReport], loading: false })
    renderPill()
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    expect(screen.getByText(/flood/i)).toBeInTheDocument()
    const statusLabel = screen.getByText('Being reviewed')
    expect(statusLabel).toBeInTheDocument()
    expect(statusLabel.querySelector('svg')).toBeInTheDocument()
  })

  it('navigates to the Response Thread on second tap when already expanded', () => {
    mockUseMyActiveReports.mockReturnValue({ reports: [baseReport], loading: false })
    renderPill()
    const btn = screen.getByRole('button')
    fireEvent.click(btn) // expand
    fireEvent.click(btn) // navigate
    expect(mockNavigate).toHaveBeenCalledWith('/track/a1b2c3d4')
  })

  it('opens the responder notice at the same Response Thread route', () => {
    mockUseMyActiveReports.mockReturnValue({
      reports: [{ ...baseReport, status: 'assigned' }],
      loading: false,
    })
    renderPill()

    fireEvent.click(screen.getByRole('button', { name: 'View report' }))
    expect(mockNavigate).toHaveBeenCalledWith('/track/a1b2c3d4')
  })

  it('renders nothing when all reports are terminal', () => {
    mockUseMyActiveReports.mockReturnValue({
      reports: [{ ...baseReport, status: 'resolved' }],
      loading: false,
    })
    renderPill()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('treats queued as non-terminal', () => {
    mockUseMyActiveReports.mockReturnValue({
      reports: [{ ...baseReport, status: 'queued' }],
      loading: false,
    })
    renderPill()
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('treats reopened as non-terminal', () => {
    mockUseMyActiveReports.mockReturnValue({
      reports: [{ ...baseReport, status: 'reopened' }],
      loading: false,
    })
    renderPill()
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('shows badge count when multiple active reports', () => {
    mockUseMyActiveReports.mockReturnValue({
      reports: [
        { ...baseReport, submittedAt: 1713350400000 },
        { ...baseReport, publicRef: 'b2c3d4e5', submittedAt: 1713350500000 },
        { ...baseReport, publicRef: 'c3d4e5f6', submittedAt: 1713350300000 },
      ],
      loading: false,
    })
    renderPill()
    // Collapsed state shows +3 badge
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})

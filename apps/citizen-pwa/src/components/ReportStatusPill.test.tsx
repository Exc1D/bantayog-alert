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

vi.mock('../hooks/useReducedMotion.js', () => ({
  useReducedMotion: () => false,
}))

vi.mock('framer-motion', () => ({
  motion: {
    button: ({
      children,
      onClick,
      className,
      style,
      'aria-label': ariaLabel,
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
      'aria-label'?: string
      initial?: unknown
      animate?: unknown
      transition?: unknown
    }) => (
      <button onClick={onClick} className={className} style={style} aria-label={ariaLabel}>
        {children}
      </button>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { ReportStatusPill } from './ReportStatusPill'

function renderPill() {
  return render(
    <MemoryRouter>
      <ReportStatusPill />
    </MemoryRouter>,
  )
}

beforeEach(() => mockNavigate.mockReset())

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
  it('renders pill when there is an active report', () => {
    mockUseMyActiveReports.mockReturnValue({ reports: [baseReport], loading: false })
    renderPill()
    expect(screen.getByRole('button')).toBeInTheDocument()
    expect(screen.getByText(/Flood/)).toBeInTheDocument()
    expect(screen.getByText(/Daet/)).toBeInTheDocument()
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

  it('shows +N badge when multiple active reports', () => {
    mockUseMyActiveReports.mockReturnValue({
      reports: [
        { ...baseReport, submittedAt: 1713350400000 },
        { ...baseReport, publicRef: 'b2c3d4e5', submittedAt: 1713350500000 },
        { ...baseReport, publicRef: 'c3d4e5f6', submittedAt: 1713350300000 },
      ],
      loading: false,
    })
    renderPill()
    expect(screen.getByText('+2')).toBeInTheDocument()
  })

  it('navigates to TrackingScreen on tap', () => {
    mockUseMyActiveReports.mockReturnValue({ reports: [baseReport], loading: false })
    renderPill()
    fireEvent.click(screen.getByRole('button'))
    expect(mockNavigate).toHaveBeenCalledWith('/reports/a1b2c3d4')
  })

  it('renders nothing when reports list is empty', () => {
    mockUseMyActiveReports.mockReturnValue({ reports: [], loading: false })
    renderPill()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

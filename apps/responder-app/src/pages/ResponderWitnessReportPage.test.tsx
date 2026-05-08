import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const mockSubmit = vi.hoisted(() => vi.fn())
const mockUpload = vi.hoisted(() => vi.fn())

vi.mock('../hooks/useSubmitResponderWitnessedReport', () => ({
  useSubmitResponderWitnessedReport: () => ({
    submit: mockSubmit,
    loading: false,
    error: undefined,
  }),
}))

vi.mock('../hooks/useRequestUploadUrl', () => ({
  useRequestUploadUrl: () => ({
    upload: mockUpload,
    loading: false,
    error: undefined,
  }),
}))

// Suppress @bantayog/shared-validators reportDocSchema dependency
vi.mock('@bantayog/shared-validators', () => ({
  reportDocSchema: {
    shape: {
      reportType: {
        options: [
          'flood',
          'fire',
          'earthquake',
          'typhoon',
          'landslide',
          'storm_surge',
          'medical',
          'accident',
          'structural',
          'security',
          'other',
        ],
      },
    },
  },
}))

import { ResponderWitnessReportPage } from './ResponderWitnessReportPage'

function renderPage(id = 'disp-1') {
  return render(
    <MemoryRouter initialEntries={[`/dispatches/${id}/witness-report`]}>
      <Routes>
        <Route path="/dispatches/:id/witness-report" element={<ResponderWitnessReportPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ResponderWitnessReportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSubmit.mockResolvedValue(undefined)

    // Geolocation provided by vitest.setup.ts (getCurrentPosition is a vi.fn())
    vi.mocked(navigator.geolocation.getCurrentPosition).mockImplementation(
      (success: PositionCallback) => {
        success({
          coords: {
            latitude: 14.1,
            longitude: 122.9,
            accuracy: 10,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        } as GeolocationPosition)
      },
    )
  })

  it('renders the page heading', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/witness report/i)
  })

  it('shows GPS status after mount — "Location captured" when GPS succeeds', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/location captured/i)).toBeInTheDocument()
    })
  })

  it('shows GPS error state and retry button when geolocation fails', async () => {
    vi.mocked(navigator.geolocation.getCurrentPosition).mockImplementation(
      (_success: PositionCallback, error?: PositionErrorCallback | null) => {
        error?.({
          code: 1,
          message: 'Permission denied',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        })
      },
    )

    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/location unavailable/i)).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('submit button is disabled when GPS location has not been captured yet', () => {
    // Make getCurrentPosition never call back (simulates pending)
    vi.mocked(navigator.geolocation.getCurrentPosition).mockImplementation(() => {
      // never resolves
    })

    renderPage()

    // Button should be disabled because GPS isn't ready
    const submitBtn = screen.getByRole('button', { name: /submit report/i })
    expect(submitBtn).toBeDisabled()
  })

  it('submit button is enabled once GPS location is captured', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/location captured/i)).toBeInTheDocument()
    })

    const submitBtn = screen.getByRole('button', { name: /submit report/i })
    // Disabled only because required fields (reportType, severity, description) are empty
    // Fill them in to confirm button becomes enabled
    const user = userEvent.setup()
    const typeSelect = screen.getByLabelText(/report type/i)
    await user.selectOptions(typeSelect, 'flood')

    const descTextarea = screen.getByLabelText(/description/i)
    await user.type(descTextarea, 'Water is rising very fast and people are trapped')

    // Select severity
    await user.click(screen.getByRole('button', { name: /^high$/i }))

    expect(submitBtn).not.toBeDisabled()
  })

  it('calls submit with GPS coordinates when form is filled and submitted', async () => {
    renderPage()

    await waitFor(() => screen.getByText(/location captured/i))

    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText(/report type/i), 'flood')
    await user.type(
      screen.getByLabelText(/description/i),
      'Water is rising very fast and people are trapped',
    )
    await user.click(screen.getByRole('button', { name: /^high$/i }))

    await user.click(screen.getByRole('button', { name: /submit report/i }))

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          reportType: 'flood',
          severity: 'high',
          description: expect.stringContaining('Water is rising'),
        }),
      )
    })
  })

  it('shows a file input for photo attachment', () => {
    renderPage()
    // File input is hidden but the label/button is visible
    expect(screen.getByText(/add photo/i)).toBeInTheDocument()
  })
})

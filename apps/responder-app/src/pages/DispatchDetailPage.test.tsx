import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const detailState = vi.hoisted(() => ({
  dispatch: {
    dispatchId: 'd-1',
    reportId: 'report-1',
    status: 'accepted',
    uiStatus: 'accepted',
    terminalSurface: null as string | null,
    cancelReason: '',
  },
  loading: false,
  error: null as Error | null,
  report: {
    reportType: 'flood',
    severity: 'medium',
    status: 'verified',
    description: 'Heavy water in the streets',
    municipalityId: 'daet',
    municipalityLabel: 'Daet',
    barangayId: 'Barangay 5',
    publicLocation: { latitude: 14.1, longitude: 122.9 },
    source: 'web',
    submittedAt: 1700000000000,
  },
  mockAccept: vi.fn(() => Promise.resolve()),
  mockDecline: vi.fn(),
  mockAdvance: vi.fn(() => Promise.resolve()),
  mockMarkUnable: vi.fn(),
  mockAddNote: vi.fn(),
  acceptLoading: false,
  declineLoading: false,
  advanceLoading: false,
  unableLoading: false,
  addNoteLoading: false,
  acceptError: undefined as Error | undefined,
  declineError: undefined as Error | undefined,
  advanceError: undefined as Error | undefined,
  unableError: undefined as Error | undefined,
  addNoteError: undefined as Error | undefined,
  fieldNoteDraft: {
    value: '',
    setValue: vi.fn(),
    clear: vi.fn(() => Promise.resolve()),
    loaded: true,
  },
}))

vi.mock('../hooks/useDispatch', () => ({
  useDispatch: () => ({
    dispatch: detailState.dispatch,
    loading: detailState.loading,
    error: detailState.error,
    refresh: vi.fn(),
  }),
}))

vi.mock('../hooks/useReport', () => ({
  useReport: () => ({
    report: detailState.report,
    loading: false,
    error: null,
  }),
}))

vi.mock('../hooks/useAcceptDispatch', () => ({
  useAcceptDispatch: () => ({
    accept: detailState.mockAccept,
    loading: detailState.acceptLoading,
    error: detailState.acceptError,
  }),
}))

vi.mock('../hooks/useAdvanceDispatch', () => ({
  useAdvanceDispatch: () => ({
    advance: detailState.mockAdvance,
    loading: detailState.advanceLoading,
    error: detailState.advanceError,
  }),
}))

vi.mock('../hooks/useDeclineDispatch', () => ({
  useDeclineDispatch: () => ({
    decline: detailState.mockDecline,
    loading: detailState.declineLoading,
    error: detailState.declineError,
  }),
}))

vi.mock('../hooks/useMarkDispatchUnableToComplete', () => ({
  useMarkDispatchUnableToComplete: () => ({
    markUnableToComplete: detailState.mockMarkUnable,
    loading: detailState.unableLoading,
    error: detailState.unableError,
  }),
}))

vi.mock('../hooks/useAddFieldNote', () => ({
  useAddFieldNote: () => ({
    addNote: detailState.mockAddNote,
    loading: detailState.addNoteLoading,
    error: detailState.addNoteError,
  }),
}))

vi.mock('../hooks/useFieldNoteDraft', () => ({
  useFieldNoteDraft: () => detailState.fieldNoteDraft,
}))

import { DispatchDetailPage } from './DispatchDetailPage'

function renderPage(dispatchId = 'd-1') {
  return render(
    <MemoryRouter initialEntries={[`/dispatches/${dispatchId}`]}>
      <Routes>
        <Route path="/dispatches/:dispatchId" element={<DispatchDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('DispatchDetailPage', () => {
  beforeEach(() => {
    detailState.dispatch = {
      dispatchId: 'd-1',
      reportId: 'report-1',
      status: 'accepted',
      uiStatus: 'accepted',
      terminalSurface: null,
      cancelReason: '',
    }
    detailState.loading = false
    detailState.error = null
    detailState.mockAccept.mockClear()
    detailState.mockDecline.mockClear()
    detailState.mockAdvance.mockClear()
    detailState.mockMarkUnable.mockClear()
    detailState.mockAddNote.mockClear()
    detailState.acceptLoading = false
    detailState.declineLoading = false
    detailState.advanceLoading = false
    detailState.unableLoading = false
    detailState.addNoteLoading = false
    detailState.acceptError = undefined
    detailState.declineError = undefined
    detailState.advanceError = undefined
    detailState.unableError = undefined
    detailState.addNoteError = undefined
    detailState.fieldNoteDraft = {
      value: '',
      setValue: vi.fn(),
      clear: vi.fn(() => Promise.resolve()),
      loaded: true,
    }
  })

  it('shows an "Acknowledging" status indicator while auto-advance from accepted is in-flight', () => {
    detailState.mockAdvance.mockReturnValue(new Promise(() => undefined))
    renderPage()

    expect(detailState.mockAdvance).toHaveBeenCalledWith('acknowledged')
    expect(screen.getByRole('status')).toHaveTextContent(/acknowledg/i)
    expect(screen.getByTestId('dispatch-status-d-1')).toBeInTheDocument()
  })

  it('shows pending state with Accept and Decline buttons', () => {
    detailState.dispatch.status = 'pending'
    detailState.dispatch.uiStatus = 'pending'
    renderPage()

    expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument()
    expect(screen.getByText(/decline/i)).toBeInTheDocument()
  })

  it('calls accept when the Accept button is clicked', async () => {
    detailState.dispatch.status = 'pending'
    detailState.dispatch.uiStatus = 'pending'
    renderPage()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /accept/i }))

    expect(detailState.mockAccept).toHaveBeenCalledTimes(1)
  })

  it('shows En Route button when status is acknowledged', () => {
    detailState.dispatch.status = 'acknowledged'
    detailState.dispatch.uiStatus = 'acknowledged'
    renderPage()

    expect(screen.getByRole('button', { name: /en route/i })).toBeInTheDocument()
    expect(screen.getByTestId('dispatch-status-d-1')).toBeInTheDocument()
  })

  it('explains location access before showing live distance', () => {
    detailState.dispatch.status = 'acknowledged'
    detailState.dispatch.uiStatus = 'acknowledged'
    renderPage()

    expect(screen.getByText(/enable location access/i)).toBeInTheDocument()
    expect(screen.getByText(/navigate to scene still works/i)).toBeInTheDocument()
  })

  it('treats denied location access as recoverable pre-arrival state', async () => {
    const originalGeolocation = navigator.geolocation
    const deniedError = {
      code: 1,
      message: 'User denied Geolocation',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    } as GeolocationPositionError
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn((_success: PositionCallback, error?: PositionErrorCallback) => {
          queueMicrotask(() => {
            error?.(deniedError)
          })
        }),
      },
      configurable: true,
    })
    detailState.dispatch.status = 'acknowledged'
    detailState.dispatch.uiStatus = 'acknowledged'
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    try {
      renderPage()

      await waitFor(() => {
        expect(consoleWarn).toHaveBeenCalledWith(
          '[DispatchDetailPage] geolocation unavailable:',
          1,
          'User denied Geolocation',
        )
      })

      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: /pre-arrival info/i }))

      expect(screen.getAllByText(/enable location access/i)).toHaveLength(2)
      expect(consoleError).not.toHaveBeenCalled()
    } finally {
      Object.defineProperty(navigator, 'geolocation', {
        value: originalGeolocation,
        configurable: true,
      })
      consoleError.mockRestore()
      consoleWarn.mockRestore()
    }
  })

  it('shows On Scene button when status is en_route', () => {
    detailState.dispatch.status = 'en_route'
    detailState.dispatch.uiStatus = 'heading_to_scene'
    renderPage()

    expect(screen.getByRole('button', { name: /on scene/i })).toBeInTheDocument()
    expect(screen.getByTestId('dispatch-status-d-1')).toBeInTheDocument()
  })

  it('disables Mark Resolved when resolution summary is empty', () => {
    detailState.dispatch.status = 'on_scene'
    detailState.dispatch.uiStatus = 'on_scene'
    renderPage()

    const resolveBtn = screen.getByRole('button', { name: /mark resolved/i })
    expect(resolveBtn).toBeDisabled()
  })

  it('submits decline reason after selecting from dropdown', async () => {
    detailState.dispatch.status = 'pending'
    detailState.dispatch.uiStatus = 'pending'
    detailState.mockDecline.mockResolvedValueOnce(undefined)
    renderPage()

    const user = userEvent.setup()

    // Open the decline section
    await user.click(screen.getByText(/decline/i))

    const select = screen.getByLabelText(/decline reason/i)
    await user.selectOptions(select, 'Too far away')

    await user.click(screen.getByRole('button', { name: /confirm decline/i }))

    expect(detailState.mockDecline).toHaveBeenCalledWith('Too far away')
  })

  it('renders RaceLossScreen when accept errors with already-exists', () => {
    detailState.dispatch.status = 'pending'
    detailState.dispatch.uiStatus = 'pending'
    detailState.acceptError = Object.assign(new Error('already exists'), {
      code: 'functions/already-exists',
    })
    renderPage()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Already Claimed/i)
  })

  it('renders CancelledScreen when terminalSurface is cancelled', () => {
    detailState.dispatch.status = 'cancelled'
    detailState.dispatch.uiStatus = 'cancelled'
    detailState.dispatch.terminalSurface = 'cancelled'
    detailState.dispatch.cancelReason = 'False alarm'
    renderPage()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Dispatch Cancelled/i)
  })

  it('renders accessible state machine progress ring', () => {
    detailState.dispatch.status = 'en_route'
    detailState.dispatch.uiStatus = 'heading_to_scene'
    renderPage()

    const ring = screen.getByRole('progressbar', { name: /dispatch progress/i })
    expect(ring).toHaveAttribute('aria-valuenow', '60')
    expect(ring).toHaveAttribute('aria-valuetext', 'En Route')
    expect(screen.getByText('60%')).toBeInTheDocument()
  })

  it('keeps pending dispatches out of the accepted timeline step', () => {
    detailState.dispatch.status = 'pending'
    detailState.dispatch.uiStatus = 'pending'
    renderPage()

    const ring = screen.getByRole('progressbar', { name: /dispatch progress/i })
    expect(ring).toHaveAttribute('aria-valuetext', 'Pending acceptance')
    expect(screen.queryByText('Accepted')?.closest('[aria-current="step"]')).toBeNull()
  })

  it('disables field-note editing until the draft finishes loading', () => {
    detailState.dispatch.status = 'acknowledged'
    detailState.dispatch.uiStatus = 'acknowledged'
    detailState.fieldNoteDraft = {
      value: '',
      setValue: vi.fn(),
      clear: vi.fn(() => Promise.resolve()),
      loaded: false,
    }

    renderPage()

    expect(screen.getByRole('textbox', { name: /field notes/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /add note/i })).toBeDisabled()
  })

  it('logs draft-clear failures separately from add-note failures', async () => {
    detailState.dispatch.status = 'acknowledged'
    detailState.dispatch.uiStatus = 'acknowledged'
    detailState.fieldNoteDraft = {
      value: 'Road blocked',
      setValue: vi.fn(),
      clear: vi.fn(() => Promise.reject(new Error('clear failed'))),
      loaded: true,
    }
    detailState.mockAddNote.mockResolvedValueOnce(undefined)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    renderPage()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /add note/i }))

    await waitFor(() => {
      expect(detailState.fieldNoteDraft.clear).toHaveBeenCalledTimes(1)
    })
    expect(consoleError).toHaveBeenCalledWith(
      '[DispatchDetailPage] clearing field-note draft failed:',
      expect.any(Error),
    )

    consoleError.mockRestore()
  })
})

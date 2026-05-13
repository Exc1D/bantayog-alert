import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import DashboardPage from '../pages/DashboardPage'
import { useCommandCenterStore } from '../stores/commandCenterStore'

const mockVerifyReport = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ status: 'VERIFIED', reportId: 'r1' }),
)
const mockRejectReport = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ status: 'REJECTED', reportId: 'r1' }),
)

vi.mock('../services/callables', () => ({
  callables: {
    verifyReport: mockVerifyReport,
    rejectReport: mockRejectReport,
  },
}))

const mockPlay = vi.hoisted(() => vi.fn())
const mockPlayError = vi.hoisted(() => vi.fn())

vi.mock('../hooks/useAudioAlerts', () => ({
  useAudioAlerts: () => ({
    enabled: false,
    toggle: vi.fn(),
    play: mockPlay,
    playError: mockPlayError,
  }),
}))

const mockSendSync = vi.hoisted(() => vi.fn())
const mockSubscribe = vi.hoisted(() => vi.fn().mockReturnValue(vi.fn()))

vi.mock('../providers/WindowSyncProvider', () => ({
  useWindowSyncContext: () => ({
    sendSync: mockSendSync,
    subscribe: mockSubscribe,
  }),
}))

vi.mock('../hooks/useFirestoreListeners', () => ({
  useFirestoreListeners: () => ({
    loading: false,
    error: null,
    reports: [
      {
        id: 'r1',
        type: 'FLOOD',
        severity: 'HIGH',
        municipality: 'Daet',
        barangay: 'Camambugan',
        createdAt: '14:02',
        status: 'PENDING',
        description: 'Water rising',
        reporterName: 'Juan',
        reporterPhone: '0917xxx',
        latitude: 14.1,
        longitude: 122.9,
        updatedAt: '',
      },
      {
        id: 'r2',
        type: 'FIRE',
        severity: 'MEDIUM',
        municipality: 'Labo',
        barangay: 'San Roque',
        createdAt: '14:08',
        status: 'PENDING',
        description: 'House fire',
        reporterName: 'Maria',
        reporterPhone: '0918xxx',
        latitude: 14.0,
        longitude: 122.8,
        updatedAt: '',
      },
    ],
    reportOps: [],
    alerts: [],
    responders: [],
  }),
}))

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCommandCenterStore.setState({
      selectedMunicipalityId: null,
      selectedReportId: null,
      triageFilters: {},
      chartTimeRange: '7d',
      statusBarExpanded: false,
      statusBarExpandedOverride: null,
      mapBounds: null,
      activeOverlays: new Set(['all_incidents']),
      triagePanelOpen: false,
      lastSyncMessage: null,
      suppressNextBroadcast: false,
    })
  })

  it('renders header and status bar', () => {
    render(<DashboardPage />, { wrapper: BrowserRouter })
    expect(screen.getByText('PDRRMO Camarines Norte')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // pending count from 2 PENDING reports
  })

  it('opens map window when M key pressed', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<DashboardPage />, { wrapper: BrowserRouter })
    fireEvent.keyDown(window, { key: 'm' })
    expect(openSpy).toHaveBeenCalledWith('/map', 'bantayog-map', 'width=1200,height=900')
    openSpy.mockRestore()
  })

  it('ignores shortcuts when input is focused', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<DashboardPage />, { wrapper: BrowserRouter })
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    fireEvent.keyDown(window, { key: 'm' })
    expect(openSpy).not.toHaveBeenCalled()
    document.body.removeChild(input)
    openSpy.mockRestore()
  })

  it('verifies focused report when V key pressed', () => {
    render(<DashboardPage />, { wrapper: BrowserRouter })
    // Click a row to focus it (use barangay since it's unique to triage table)
    fireEvent.click(screen.getByText('Camambugan'))
    fireEvent.keyDown(window, { key: 'v' })
    // Verify callable was invoked (async, but we can check it was called)
    expect(mockVerifyReport).toHaveBeenCalledWith(expect.objectContaining({ reportId: 'r1' }))
  })

  it('bulk verifies selected reports when Shift+V pressed', async () => {
    render(<DashboardPage />, { wrapper: BrowserRouter })
    // Select all via checkbox
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }))
    fireEvent.keyDown(window, { key: 'V', shiftKey: true })
    // Bulk verify calls verifyReport for each selected report
    await waitFor(() => {
      expect(mockVerifyReport).toHaveBeenCalledTimes(2)
    })
    expect(mockVerifyReport).toHaveBeenCalledWith(expect.objectContaining({ reportId: 'r1' }))
    expect(mockVerifyReport).toHaveBeenCalledWith(expect.objectContaining({ reportId: 'r2' }))
  })

  it('opens reject modal when R key pressed with focused report', () => {
    render(<DashboardPage />, { wrapper: BrowserRouter })
    fireEvent.click(screen.getByText('Camambugan'))
    fireEvent.keyDown(window, { key: 'r' })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('clears selection and closes modal on Escape', () => {
    render(<DashboardPage />, { wrapper: BrowserRouter })
    // Select a report and open reject modal
    fireEvent.click(screen.getByText('Camambugan'))
    fireEvent.keyDown(window, { key: 'r' })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // Press escape
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(useCommandCenterStore.getState().selectedReportId).toBeNull()
  })

  it('does not stack help modal on top of an open reject modal when ? is pressed', () => {
    render(<DashboardPage />, { wrapper: BrowserRouter })
    // Open the reject confirmation modal first
    fireEvent.click(screen.getByText('Camambugan'))
    fireEvent.keyDown(window, { key: 'r' })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // Pressing ? must NOT open the help modal on top of the reject modal
    fireEvent.keyDown(window, { key: '?' })
    // Help modal exposes the "Keyboard Shortcuts" heading — it must NOT be rendered
    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument()
  })

  it('does not stack help modal on top of an open bulk-verify modal when ? is pressed', () => {
    render(<DashboardPage />, { wrapper: BrowserRouter })
    // Open the bulk-verify confirmation modal by selecting all + Shift+V handler path:
    // simulate via the bulk-verify control surfaced when items are selected.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all' }))
    fireEvent.click(screen.getByRole('button', { name: 'Verify Selected' }))
    // Confirmation modal should be open
    expect(screen.getByText('Bulk Verify Reports')).toBeInTheDocument()
    // Pressing ? must NOT open the help modal on top
    fireEvent.keyDown(window, { key: '?' })
    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument()
  })

  it('shows popup-blocked banner with fallback link when window.open returns null', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    render(<DashboardPage />, { wrapper: BrowserRouter })
    fireEvent.keyDown(window, { key: 'm' })
    expect(openSpy).toHaveBeenCalled()
    // Banner exposes a status role and a real anchor that bypasses popup blockers
    const banner = await screen.findByRole('status', { name: /map window blocked/i })
    expect(banner).toBeInTheDocument()
    const link = await screen.findByRole('link', { name: /open map in a new tab/i })
    expect(link).toHaveAttribute('href', '/map')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
    openSpy.mockRestore()
  })
})

/**
 * Tests for MapPage Active-Only overlay filter (3c-17).
 *
 * This file uses the correct firebase mock so it does not crash at import
 * (apps/admin-desktop/src/app/firebase.ts calls getAuth eagerly at line 52,
 * which throws auth/invalid-api-key in the test env).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import MapPage from '../pages/MapPage'
import { useCommandCenterStore } from '../stores/commandCenterStore'

// --- Firebase mock (required — no VITE_FIREBASE_API_KEY in test env) ---
vi.mock('../app/firebase', () => ({ db: {} }))

// --- ProvincialMap mock: exposes the reports prop via data-testid so we can
//     assert on which reports are actually passed to the map layer. ---
vi.mock('../components/ProvincialMap', () => ({
  ProvincialMap: ({ reports }: { reports: { id: string }[] }) => (
    <div data-testid="provincial-map" data-report-count={reports.length}>
      {reports.map((r) => (
        <span key={r.id} data-testid={`map-pin-${r.id}`} />
      ))}
    </div>
  ),
}))

// --- Suppress Leaflet / MapKeyboardNav side effects ---
vi.mock('../components/MapKeyboardNav', () => ({
  MapKeyboardNav: () => null,
}))

// --- Callables mock ---
vi.mock('../services/callables', () => ({
  callables: {
    verifyReport: vi.fn().mockResolvedValue({}),
    rejectReport: vi.fn().mockResolvedValue({}),
    dispatchResponder: vi.fn().mockResolvedValue({}),
  },
}))

// --- WindowSyncProvider mock ---
vi.mock('../providers/WindowSyncProvider', () => ({
  useWindowSyncContext: () => ({
    sendSync: vi.fn(),
    subscribe: vi.fn().mockReturnValue(() => undefined),
  }),
}))

// --- Firestore listeners mock — returns a mix of active + resolved reports ---
const mockUseFirestoreListeners = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    loading: false,
    error: null,
    reports: [
      // active statuses
      {
        id: 'r-new',
        reportType: 'flood',
        severity: 'high',
        municipality: 'Daet',
        barangay: 'Camambugan',
        submittedAt: '2026-06-15T06:00:00.000Z',
        status: 'new',
        description: 'Flooding on main road',
        latitude: 14.1,
        longitude: 122.9,
      },
      {
        id: 'r-verified',
        reportType: 'fire',
        severity: 'critical',
        municipality: 'Daet',
        barangay: 'Camambugan',
        submittedAt: '2026-06-15T06:01:00.000Z',
        status: 'verified',
        description: 'Building fire',
        latitude: 14.11,
        longitude: 122.91,
      },
      // non-active statuses
      {
        id: 'r-resolved',
        reportType: 'flood',
        severity: 'low',
        municipality: 'Daet',
        barangay: 'Camambugan',
        submittedAt: '2026-06-15T05:00:00.000Z',
        status: 'resolved',
        description: 'Resolved flooding',
        latitude: 14.12,
        longitude: 122.92,
      },
      {
        id: 'r-closed',
        reportType: 'fire',
        severity: 'low',
        municipality: 'Daet',
        barangay: 'Camambugan',
        submittedAt: '2026-06-15T05:01:00.000Z',
        status: 'cancelled_false_report',
        description: 'False alarm',
        latitude: 14.13,
        longitude: 122.93,
      },
    ],
    reportOps: [],
    alerts: [],
    responders: [],
  }),
)

vi.mock('../hooks/useFirestoreListeners', () => ({
  useFirestoreListeners: mockUseFirestoreListeners,
}))

function renderMapPage() {
  return render(
    <MemoryRouter>
      <MapPage />
    </MemoryRouter>,
  )
}

describe('MapPage overlay filter (3c-17)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset store to default (all_incidents active, nothing selected)
    useCommandCenterStore.setState({
      activeOverlays: new Set(['all_incidents']),
      selectedReportId: null,
      selectedMunicipalityId: null,
    })
  })

  it('passes all 4 reports to ProvincialMap when All is active', () => {
    renderMapPage()
    const map = screen.getByTestId('provincial-map')
    expect(map).toHaveAttribute('data-report-count', '4')
    expect(screen.getByTestId('map-pin-r-new')).toBeInTheDocument()
    expect(screen.getByTestId('map-pin-r-verified')).toBeInTheDocument()
    expect(screen.getByTestId('map-pin-r-resolved')).toBeInTheDocument()
    expect(screen.getByTestId('map-pin-r-closed')).toBeInTheDocument()
  })

  it('passes only active-status reports to ProvincialMap when Active Only is selected', async () => {
    const user = userEvent.setup()
    renderMapPage()

    await user.click(screen.getByRole('button', { name: 'Active Only' }))

    const map = screen.getByTestId('provincial-map')
    // Only r-new (status: 'new') and r-verified (status: 'verified') are in ACTIVE_REPORT_STATUSES
    expect(map).toHaveAttribute('data-report-count', '2')
    expect(screen.getByTestId('map-pin-r-new')).toBeInTheDocument()
    expect(screen.getByTestId('map-pin-r-verified')).toBeInTheDocument()
    expect(screen.queryByTestId('map-pin-r-resolved')).not.toBeInTheDocument()
    expect(screen.queryByTestId('map-pin-r-closed')).not.toBeInTheDocument()
  })

  it('restores all reports when toggling back to All from Active Only', async () => {
    const user = userEvent.setup()
    // Start with active_only selected
    useCommandCenterStore.setState({
      activeOverlays: new Set(['active_only']),
      selectedReportId: null,
      selectedMunicipalityId: null,
    })
    renderMapPage()

    // Should be filtered to active-only initially
    expect(screen.getByTestId('provincial-map')).toHaveAttribute('data-report-count', '2')

    // Switch back to All
    await user.click(screen.getByRole('button', { name: 'All' }))

    expect(screen.getByTestId('provincial-map')).toHaveAttribute('data-report-count', '4')
  })
})

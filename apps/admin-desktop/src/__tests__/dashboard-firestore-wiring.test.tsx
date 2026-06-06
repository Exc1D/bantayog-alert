import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import DashboardPage from '../pages/DashboardPage'
import { useCommandCenterStore } from '../stores/commandCenterStore'

vi.mock('../hooks/useFirestoreListeners', () => ({
  useFirestoreListeners: () => ({
    loading: false,
    error: null,
    reports: [
      {
        id: 'r1',
        type: 'flood',
        severity: 'high',
        municipality: 'Daet',
        barangay: 'Camambugan',
        createdAt: '14:02',
        status: 'new',
        description: 'Water rising',
        reporterName: 'Juan',
        reporterPhone: '0917xxx',
        latitude: 14.1,
        longitude: 122.9,
        updatedAt: '',
      },
    ],
    reportOps: [],
    alerts: [],
    responders: [],
  }),
}))

vi.mock('../hooks/useOpsMetrics', () => ({
  useOpsMetrics: () => ({
    metrics: {
      avgAcceptSeconds: 120,
      fcmSuccessRate: 1,
      totalDispatches: 0,
      acceptedCount: 0,
      declinedCount: 0,
      escalatedCount: 0,
      needsAdminCount: 0,
    },
    loading: false,
    error: null,
    lastPollAt: null,
  }),
}))

describe('DashboardPage Firestore wiring', () => {
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

  it('renders reports from Firestore hook', () => {
    render(<DashboardPage />, { wrapper: BrowserRouter })
    expect(screen.getByRole('table')).toHaveTextContent('Daet')
  })
})

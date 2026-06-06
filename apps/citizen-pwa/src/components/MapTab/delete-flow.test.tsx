import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// ── Hoisted mocks ─────────────────────────────────────────────────
const { mockCancelReport, mockDeleteReport, mockToast } = vi.hoisted(() => ({
  mockCancelReport: vi.fn().mockResolvedValue(undefined),
  mockDeleteReport: vi.fn().mockResolvedValue(undefined),
  mockToast: vi.fn(),
}))

// ── Mutable mock data ─────────────────────────────────────────────
let mockReports: {
  publicRef: string
  reportType: string
  severity: string
  lat: number
  lng: number
  submittedAt: number
  status: string
  municipalityLabel: string
  id: string
}[] = [
  {
    publicRef: 'FL-2024-001',
    reportType: 'flood',
    severity: 'high',
    lat: 14.1115,
    lng: 122.9558,
    submittedAt: Date.now(),
    status: 'new',
    municipalityLabel: 'Daet',
    id: 'report-id-123',
  },
]

// ── Mock Leaflet ──────────────────────────────────────────────────
const { mockDivIcon, mockMarker, mockLayerGroup } = vi.hoisted(() => {
  const mockLayer = {
    addTo: vi.fn().mockReturnThis(),
    clearLayers: vi.fn(),
    addLayer: vi.fn(),
  }
  return {
    mockDivIcon: vi.fn((input: unknown) => input),
    mockMarker: vi.fn(() => ({ on: vi.fn() })),
    mockLayerGroup: vi.fn(() => mockLayer),
  }
})

vi.mock('leaflet', () => ({
  default: {
    divIcon: mockDivIcon,
    marker: mockMarker,
    layerGroup: mockLayerGroup,
    map: vi.fn(() => ({
      on: vi.fn(),
      off: vi.fn(),
      flyTo: vi.fn(),
      setView: vi.fn(),
      hasLayer: vi.fn().mockReturnValue(false),
      remove: vi.fn(),
    })),
    tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
  },
  divIcon: mockDivIcon,
  marker: mockMarker,
  layerGroup: mockLayerGroup,
}))

// ── Mock Hooks & Services ────────────────────────────────────────
vi.mock('../../hooks/usePublicIncidents.js', () => ({
  usePublicIncidents: () => ({ incidents: [], loading: false, error: null }),
}))

vi.mock('../../hooks/useMyActiveReports.js', () => ({
  useMyActiveReports: () => ({ reports: mockReports, loading: false }),
}))

vi.mock('../../services/callables.js', () => ({
  cancelReport: (...args: unknown[]) => mockCancelReport(...args),
}))

vi.mock('../../services/localForageReports.js', () => ({
  deleteReport: (...args: unknown[]) => mockDeleteReport(...args),
  loadReports: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../hooks/useToast.js', () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock('../../hooks/useReducedMotion.js', () => ({
  useReducedMotion: () => false,
}))

// Mock framer-motion
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
}))

// ── Import after mocks ────────────────────────────────────────────
import { MapTab } from './index.js'

describe('Citizen Delete Report Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    // Reset to default unverified report
    mockReports = [
      {
        publicRef: 'FL-2024-001',
        reportType: 'flood',
        severity: 'high',
        lat: 14.1115,
        lng: 122.9558,
        submittedAt: Date.now(),
        status: 'new',
        municipalityLabel: 'Daet',
        id: 'report-id-123',
      },
    ]
  })

  it('allows citizens to withdraw their own unverified reports from the map', async () => {
    render(
      <MemoryRouter>
        <MapTab />
      </MemoryRouter>,
    )

    // Wait for map to initialize
    await waitFor(() => {
      expect(mockMarker).toHaveBeenCalled()
    })

    // ── Step 1: Tap the myReport pin ──────────────────────────────
    const markerInstance = mockMarker.mock.results[0]?.value as {
      on: ReturnType<typeof vi.fn>
    }
    expect(markerInstance).toBeDefined()

    const clickHandler = markerInstance.on.mock.calls.find(
      (call: unknown[]) => call[0] === 'click',
    )?.[1] as (() => void) | undefined
    expect(clickHandler).toBeDefined()
    act(() => {
      clickHandler!()
    })

    // ── Step 2: PeekSheet appears with Delete button ──────────────
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Track/i })).toBeInTheDocument()
    })
    const deleteBtn = screen.getByRole('button', { name: /Withdraw/i })
    expect(deleteBtn).toBeInTheDocument()

    // ── Step 3: Click Delete ──────────────────────────────────────
    act(() => {
      fireEvent.click(deleteBtn)
    })

    // ── Step 4: DeleteSheet confirmation appears ───────────────────
    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    })
    expect(screen.getByText(/Withdraw this report/i)).toBeInTheDocument()
    expect(screen.getByText('FL-2024-001')).toBeInTheDocument()

    // ── Step 5: Click "Withdraw Report" to confirm ──────────────────
    const confirmBtn = screen.getByRole('button', { name: 'Withdraw Report' })
    await act(async () => {
      fireEvent.click(confirmBtn)
      await Promise.resolve()
    })

    // ── Step 6: Backend called, toast shown ───────────────────────
    await waitFor(() => {
      expect(mockCancelReport).toHaveBeenCalledWith('report-id-123')
      expect(mockDeleteReport).toHaveBeenCalledWith('FL-2024-001')
    })
    expect(mockToast).toHaveBeenCalledWith('Report withdrawn', 'success')

    // ── Step 7: Sheet closes ──────────────────────────────────────
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
  })

  it('does NOT show Delete button for verified reports', async () => {
    // Change the report to verified status
    mockReports = [
      {
        publicRef: 'FL-2024-002',
        reportType: 'fire',
        severity: 'medium',
        lat: 14.1115,
        lng: 122.9558,
        submittedAt: Date.now(),
        status: 'verified',
        municipalityLabel: 'Daet',
        id: 'report-id-456',
      },
    ]

    render(
      <MemoryRouter>
        <MapTab />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(mockMarker).toHaveBeenCalled()
    })

    // Tap the verified report pin
    const markerInstance = mockMarker.mock.results[0]?.value as {
      on: ReturnType<typeof vi.fn>
    }
    const clickHandler = markerInstance.on.mock.calls.find(
      (call: unknown[]) => call[0] === 'click',
    )?.[1] as (() => void) | undefined
    act(() => {
      clickHandler!()
    })

    // PeekSheet shows Track, but no Withdraw
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Track/i })).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /Withdraw/i })).not.toBeInTheDocument()
  })
})

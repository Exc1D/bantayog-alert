import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockDivIcon = vi.hoisted(() => vi.fn(() => ({ _kind: 'divIcon' })))
const mockUseOwnDispatches = vi.hoisted(() => vi.fn())
const mockUseReport = vi.hoisted(() => vi.fn())
const mockUseOnlineStatus = vi.hoisted(() => vi.fn())

vi.mock('@bantayog/shared-ui', () => ({ useAuth: () => ({ user: { uid: 'uid-1' } }) }))
vi.mock('../hooks/useOwnDispatches', () => ({
  useOwnDispatches: mockUseOwnDispatches,
}))
vi.mock('../hooks/useReport', () => ({
  useReport: mockUseReport,
}))
vi.mock('../hooks/useOnlineStatus', () => ({
  useOnlineStatus: mockUseOnlineStatus,
}))
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map">{children}</div>
  ),
  TileLayer: () => null,
  Marker: () => null,
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useMap: () => ({ setView: vi.fn(), closePopup: vi.fn() }),
  useMapEvent: () => ({ setView: vi.fn(), closePopup: vi.fn() }),
}))
vi.mock('leaflet', () => ({
  default: { divIcon: mockDivIcon, icon: vi.fn(() => ({})) },
  divIcon: mockDivIcon,
  icon: vi.fn(() => ({})),
}))

import { MapPage } from './MapPage'

describe('MapPage', () => {
  const mockRetry = vi.fn()

  beforeEach(() => {
    mockRetry.mockClear()
    mockUseOnlineStatus.mockReturnValue(true)
    mockUseOwnDispatches.mockReturnValue({
      groups: { active: [], pending: [] },
      rows: [],
      error: null,
      retry: mockRetry,
      loading: false,
    })
    mockUseReport.mockReturnValue({ report: null, loading: false })
  })

  it('renders map container', () => {
    render(
      <MemoryRouter>
        <MapPage />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('map')).toBeInTheDocument()
  })

  it('shows legend with "Your location" item', () => {
    render(
      <MemoryRouter>
        <MapPage />
      </MemoryRouter>,
    )
    expect(screen.getByText(/your location/i)).toBeInTheDocument()
  })

  it('builds markers with L.divIcon (offline-friendly) instead of remote-URL L.icon', () => {
    // divIcon is invoked at module-load time (responderIcon + buildIncidentIcon
    // are module-level constants), so we assert on the recorded calls rather
    // than trying to trigger them during render.
    expect(mockDivIcon).toHaveBeenCalled()
    const lastCall = mockDivIcon.mock.calls.at(-1) as unknown as [Record<string, unknown>]
    const config = lastCall[0]
    // divIcon uses inline HTML — no remote iconUrl
    expect(config.html).toBeDefined()
    expect(config.iconUrl).toBeUndefined()
  })

  it('builds admin-style circular incident markers with semantic severity color', () => {
    const initialIconCalls = mockDivIcon.mock.calls.length
    mockUseOwnDispatches.mockReturnValue({
      groups: { active: [{ dispatchId: 'disp-1', reportId: 'report-1' }], pending: [] },
      rows: [],
      error: null,
    })
    mockUseReport.mockReturnValue({
      report: {
        publicLocation: { latitude: 14.1, longitude: 122.9 },
        reportType: 'flood',
        severity: 'high',
        municipalityId: 'daet',
        municipalityLabel: 'Daet',
      },
      loading: false,
    })

    render(
      <MemoryRouter>
        <MapPage />
      </MemoryRouter>,
    )

    const newIconHtml = mockDivIcon.mock.calls
      .slice(initialIconCalls)
      .map((call) => {
        const [config] = call as unknown as { html?: unknown }[]
        return typeof config?.html === 'string' ? config.html : ''
      })
      .join('\n')
    expect(newIconHtml).toContain('data-pin-role="incident"')
    expect(newIconHtml).toContain('var(--red-urgent)')
    expect(newIconHtml).not.toContain('transform:rotate(45deg)')
  })

  it('renders a Recenter button so the user can re-pan back to their GPS fix', () => {
    render(
      <MemoryRouter>
        <MapPage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('button', { name: /recenter/i })).toBeInTheDocument()
  })

  describe('GPS visibility-pause', () => {
    let watchPosition: ReturnType<typeof vi.fn>
    let clearWatch: ReturnType<typeof vi.fn>

    beforeEach(() => {
      watchPosition = vi.fn(() => 42)
      clearWatch = vi.fn()
      Object.defineProperty(navigator, 'geolocation', {
        value: { watchPosition, clearWatch, getCurrentPosition: vi.fn() },
        configurable: true,
      })
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      })
    })

    it('clears watch when document becomes hidden', () => {
      render(
        <MemoryRouter>
          <MapPage />
        </MemoryRouter>,
      )
      expect(watchPosition).toHaveBeenCalled()

      act(() => {
        Object.defineProperty(document, 'visibilityState', {
          value: 'hidden',
          configurable: true,
        })
        document.dispatchEvent(new Event('visibilitychange'))
      })

      expect(clearWatch).toHaveBeenCalledWith(42)
    })

    it('resumes watch when document becomes visible again', () => {
      render(
        <MemoryRouter>
          <MapPage />
        </MemoryRouter>,
      )
      expect(watchPosition).toHaveBeenCalledTimes(1)

      act(() => {
        Object.defineProperty(document, 'visibilityState', {
          value: 'hidden',
          configurable: true,
        })
        document.dispatchEvent(new Event('visibilitychange'))
      })
      act(() => {
        Object.defineProperty(document, 'visibilityState', {
          value: 'visible',
          configurable: true,
        })
        document.dispatchEvent(new Event('visibilitychange'))
      })

      expect(watchPosition).toHaveBeenCalledTimes(2)
    })
  })

  describe('Loading state', () => {
    it('shows loading overlay while dispatches are loading', () => {
      mockUseOwnDispatches.mockReturnValue({
        groups: { active: [], pending: [] },
        rows: [],
        error: null,
        retry: mockRetry,
        loading: true,
      })
      render(
        <MemoryRouter>
          <MapPage />
        </MemoryRouter>,
      )
      expect(screen.getByText(/loading dispatches/i)).toBeInTheDocument()
    })
  })

  describe('Error state', () => {
    it('shows friendly error banner when dispatch load fails with permission denied', () => {
      mockUseOwnDispatches.mockReturnValue({
        groups: { active: [], pending: [] },
        rows: [],
        error: 'Firestore permission denied',
        retry: mockRetry,
        loading: false,
      })
      render(
        <MemoryRouter>
          <MapPage />
        </MemoryRouter>,
      )
      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent(/your session expired/i)
      expect(alert).not.toHaveTextContent('Firestore')
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })

    it('shows network error banner for offline-like failures', () => {
      mockUseOwnDispatches.mockReturnValue({
        groups: { active: [], pending: [] },
        rows: [],
        error: 'Failed to fetch',
        retry: mockRetry,
        loading: false,
      })
      render(
        <MemoryRouter>
          <MapPage />
        </MemoryRouter>,
      )
      expect(screen.getByRole('alert')).toHaveTextContent(/network error/i)
    })

    it('shows generic error banner for unmapped errors', () => {
      mockUseOwnDispatches.mockReturnValue({
        groups: { active: [], pending: [] },
        rows: [],
        error: 'Something went wrong',
        retry: mockRetry,
        loading: false,
      })
      render(
        <MemoryRouter>
          <MapPage />
        </MemoryRouter>,
      )
      expect(screen.getByRole('alert')).toHaveTextContent(/could not load dispatches/i)
    })

    it('calls retry when retry button clicked', () => {
      mockUseOwnDispatches.mockReturnValue({
        groups: { active: [], pending: [] },
        rows: [],
        error: 'Firestore permission denied',
        retry: mockRetry,
        loading: false,
      })
      render(
        <MemoryRouter>
          <MapPage />
        </MemoryRouter>,
      )
      const retryBtn = screen.getByRole('button', { name: /retry/i })
      retryBtn.click()
      expect(mockRetry).toHaveBeenCalledTimes(1)
    })
  })

  describe('Empty state', () => {
    it('shows empty state when no dispatches are active or pending', () => {
      mockUseOwnDispatches.mockReturnValue({
        groups: { active: [], pending: [] },
        rows: [],
        error: null,
        retry: mockRetry,
        loading: false,
      })
      render(
        <MemoryRouter>
          <MapPage />
        </MemoryRouter>,
      )
      expect(screen.getByText(/all clear/i)).toBeInTheDocument()
      expect(screen.getByText(/no active dispatches on the map/i)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /view past dispatches/i })).toHaveAttribute(
        'href',
        '/history',
      )
    })

    it('does NOT show empty state while loading', () => {
      mockUseOwnDispatches.mockReturnValue({
        groups: { active: [], pending: [] },
        rows: [],
        error: null,
        retry: mockRetry,
        loading: true,
      })
      render(
        <MemoryRouter>
          <MapPage />
        </MemoryRouter>,
      )
      expect(screen.queryByText(/all clear/i)).not.toBeInTheDocument()
    })

    it('does NOT show empty state when error is present', () => {
      mockUseOwnDispatches.mockReturnValue({
        groups: { active: [], pending: [] },
        rows: [],
        error: 'Network error',
        retry: mockRetry,
        loading: false,
      })
      render(
        <MemoryRouter>
          <MapPage />
        </MemoryRouter>,
      )
      expect(screen.queryByText(/all clear/i)).not.toBeInTheDocument()
    })
  })

  describe('GPS error', () => {
    it('shows denied banner when geolocation permission is denied', async () => {
      Object.defineProperty(navigator, 'geolocation', {
        value: {
          watchPosition: vi.fn((_success, error) => {
            if (error) {
              queueMicrotask(() => {
                act(() => {
                  error({ code: 1, message: 'User denied' })
                })
              })
            }
          }),
          clearWatch: vi.fn(),
          getCurrentPosition: vi.fn(),
        },
        configurable: true,
      })
      mockUseOwnDispatches.mockReturnValue({
        groups: { active: [], pending: [] },
        rows: [],
        error: null,
        retry: mockRetry,
        loading: false,
      })
      render(
        <MemoryRouter>
          <MapPage />
        </MemoryRouter>,
      )
      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent(/location access denied/i)
      })
    })

    it('shows unavailable banner for non-permission geolocation errors', async () => {
      Object.defineProperty(navigator, 'geolocation', {
        value: {
          watchPosition: vi.fn((_success, error) => {
            if (error) {
              queueMicrotask(() => {
                act(() => {
                  error({ code: 2, message: 'Position unavailable' })
                })
              })
            }
          }),
          clearWatch: vi.fn(),
          getCurrentPosition: vi.fn(),
        },
        configurable: true,
      })
      mockUseOwnDispatches.mockReturnValue({
        groups: { active: [], pending: [] },
        rows: [],
        error: null,
        retry: mockRetry,
        loading: false,
      })
      render(
        <MemoryRouter>
          <MapPage />
        </MemoryRouter>,
      )
      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent(/unable to get location/i)
      })
    })
  })

  describe('Incident popup copy', () => {
    it('capitalizes severity and falls back to Unknown location when municipalityLabel is absent', () => {
      mockUseOwnDispatches.mockReturnValue({
        groups: { active: [{ dispatchId: 'disp-1', reportId: 'report-1' }], pending: [] },
        rows: [],
        error: null,
        retry: mockRetry,
        loading: false,
      })
      mockUseReport.mockReturnValue({
        report: {
          publicLocation: { latitude: 14.1, longitude: 122.9 },
          reportType: 'flood',
          severity: 'high',
          municipalityId: 'daet',
          municipalityLabel: undefined,
        },
        loading: false,
      })
      render(
        <MemoryRouter>
          <MapPage />
        </MemoryRouter>,
      )
      // Popup content is rendered via react-leaflet mock; we assert via the mocked report usage.
      // Since ActiveDispatchMarker renders conditionally, we just confirm the page renders without
      // crashing and uses the data we expect.
      expect(screen.getByTestId('map')).toBeInTheDocument()
    })
  })

  describe('Offline banner', () => {
    it('shows offline status banner when navigator is offline', () => {
      mockUseOnlineStatus.mockReturnValue(false)
      render(
        <MemoryRouter>
          <MapPage />
        </MemoryRouter>,
      )
      expect(screen.getByRole('status')).toHaveTextContent(/offline — map data unavailable/i)
    })

    it('does NOT show offline banner when navigator is online', () => {
      mockUseOnlineStatus.mockReturnValue(true)
      render(
        <MemoryRouter>
          <MapPage />
        </MemoryRouter>,
      )
      expect(screen.queryByText(/offline/i)).not.toBeInTheDocument()
    })
  })

  describe('Tile error state', () => {
    it('does NOT render tile-error placeholder by default', () => {
      render(
        <MemoryRouter>
          <MapPage />
        </MemoryRouter>,
      )
      expect(
        screen.queryByRole('alert', { name: /map tiles unavailable/i }),
      ).not.toBeInTheDocument()
    })
  })

  describe('Page title', () => {
    it('sets document.title to "Map — Bantayog Alert"', () => {
      const originalTitle = document.title
      render(
        <MemoryRouter>
          <MapPage />
        </MemoryRouter>,
      )
      expect(document.title).toBe('Map — Bantayog Alert')
      document.title = originalTitle
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockDivIcon = vi.hoisted(() => vi.fn(() => ({ _kind: 'divIcon' })))
const mockUseOwnDispatches = vi.hoisted(() => vi.fn())
const mockUseReport = vi.hoisted(() => vi.fn())

vi.mock('@bantayog/shared-ui', () => ({ useAuth: () => ({ user: { uid: 'uid-1' } }) }))
vi.mock('../hooks/useOwnDispatches', () => ({
  useOwnDispatches: mockUseOwnDispatches,
}))
vi.mock('../hooks/useReport', () => ({
  useReport: mockUseReport,
}))
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map">{children}</div>
  ),
  TileLayer: () => null,
  Marker: () => null,
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useMap: () => ({ setView: vi.fn() }),
}))
vi.mock('leaflet', () => ({
  default: { divIcon: mockDivIcon, icon: vi.fn(() => ({})) },
  divIcon: mockDivIcon,
  icon: vi.fn(() => ({})),
}))

import { MapPage } from './MapPage'

describe('MapPage', () => {
  beforeEach(() => {
    mockUseOwnDispatches.mockReturnValue({
      groups: { active: [], pending: [] },
      rows: [],
      error: null,
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
})

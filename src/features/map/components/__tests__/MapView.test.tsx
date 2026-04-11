import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import L from 'leaflet'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MapView } from '../MapView'

// Mock Leaflet library
vi.mock('leaflet', () => ({
  default: {
    map: vi.fn(),
    tileLayer: vi.fn(() => ({
      addTo: vi.fn(),
    })),
    marker: vi.fn(() => ({
      addTo: vi.fn(),
      on: vi.fn(),
    })),
    circle: vi.fn(() => ({
      addTo: vi.fn(),
    })),
    divIcon: vi.fn(() => ({})),
  },
}))

// Mock CSS import
vi.mock('leaflet/dist/leaflet.css', () => ({}))

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn(),
  removeItem: vi.fn(),
  length: 0,
  key: vi.fn(),
}
global.localStorage = localStorageMock as any

// Mock useGeolocation hook
vi.mock('@/shared/hooks/useGeolocation', () => ({
  useGeolocation: vi.fn(),
}))

// Mock useDisasterReports hook
vi.mock('../../hooks/useDisasterReports', () => ({
  useDisasterReports: vi.fn(),
}))

import { useGeolocation } from '@/shared/hooks/useGeolocation'
import { useDisasterReports } from '../../hooks/useDisasterReports'

describe('MapView', () => {
  const mockMapInstance = {
    setView: vi.fn(),
    remove: vi.fn(),
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
    hasLayer: vi.fn(() => true),
    getZoom: vi.fn(() => 10),
    setZoom: vi.fn(),
    flyTo: vi.fn(),
    invalidateSize: vi.fn(),
    getCenter: vi.fn(() => ({ lat: 14.5995, lng: 120.9842 })),
    on: vi.fn(),
    off: vi.fn(),
  }

  const mockMarker = {
    addTo: vi.fn(function(this: any) { this.added = true; return this; }),
    on: vi.fn(function(this: any, event: string, handler: () => void) { this.eventHandler = handler; return this; }),
    bindPopup: vi.fn(function(this: any) { return this; }),
    added: false,
  }

  const mockCircle = {
    addTo: vi.fn(),
  }

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </BrowserRouter>
  )

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(L.map).mockReturnValue(mockMapInstance as any)
    vi.mocked(L.marker).mockReturnValue(mockMarker as any)
    vi.mocked(L.circle).mockReturnValue(mockCircle as any)

    // Default geolocation state
    vi.mocked(useGeolocation).mockReturnValue({
      coordinates: null,
      loading: false,
      error: null,
      manualLocation: null,
      setManualLocation: vi.fn(),
    })

    // Default disaster reports state
    vi.mocked(useDisasterReports).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      isSuccess: true,
      isFetching: false,
    } as any)
  })

  describe('when rendered', () => {
    it('should show loading state initially', async () => {
      render(<MapView />, { wrapper })

      expect(screen.getByTestId('map-loading')).toBeInTheDocument()
      expect(screen.getByText(/loading map/i)).toBeInTheDocument()
    })

    it('should render map container', () => {
      render(<MapView />, { wrapper })

      expect(screen.getByTestId('map-view')).toBeInTheDocument()
    })

    it('should use default center coordinates (Camarines Norte)', async () => {
      render(<MapView />, { wrapper })

      await waitFor(() => {
        expect(vi.mocked(L.map)).toHaveBeenCalledWith(
          expect.any(HTMLDivElement),
          expect.objectContaining({
            center: [14.5995, 120.9842],
            zoom: 10,
          })
        )
      })
    })

    it('should use default zoom level of 10', async () => {
      render(<MapView />, { wrapper })

      await waitFor(() => {
        expect(vi.mocked(L.map)).toHaveBeenCalledWith(
          expect.any(HTMLDivElement),
          expect.objectContaining({
            zoom: 10,
          })
        )
      })
    })
  })

  describe('when initialized', () => {
    it('should add OpenStreetMap tile layer', async () => {
      render(<MapView />, { wrapper })

      await waitFor(() => {
        expect(vi.mocked(L.tileLayer)).toHaveBeenCalledWith(
          'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          expect.objectContaining({
            attribution: expect.stringContaining('OpenStreetMap'),
            maxZoom: 19,
          })
        )
      })
    })

    it('should hide loading state when map is ready', async () => {
      render(<MapView />, { wrapper })

      await waitFor(() => {
        expect(screen.queryByTestId('map-loading')).not.toBeInTheDocument()
      })
    })
  })

  describe('when custom props are provided', () => {
    it('should use custom center coordinates', async () => {
      const customCenter: [number, number] = [10.3157, 123.8854]

      render(<MapView center={customCenter} />, { wrapper })

      await waitFor(() => {
        expect(vi.mocked(L.map)).toHaveBeenCalledWith(
          expect.any(HTMLDivElement),
          expect.objectContaining({
            center: customCenter,
          })
        )
      })
    })

    it('should use custom zoom level', async () => {
      render(<MapView zoom={15} />, { wrapper })

      await waitFor(() => {
        expect(vi.mocked(L.map)).toHaveBeenCalledWith(
          expect.any(HTMLDivElement),
          expect.objectContaining({
            zoom: 15,
          })
        )
      })
    })

    it('should use both custom center and zoom', async () => {
      const customCenter: [number, number] = [15.5, 121.0]

      render(<MapView center={customCenter} zoom={12} />, { wrapper })

      await waitFor(() => {
        expect(vi.mocked(L.map)).toHaveBeenCalledWith(
          expect.any(HTMLDivElement),
          expect.objectContaining({
            center: customCenter,
            zoom: 12,
          })
        )
      })
    })
  })

  describe('map container', () => {
    it('should have full viewport height', () => {
      render(<MapView />, { wrapper })
      const mapContainer = screen.getByTestId('map-view')

      expect(mapContainer).toHaveStyle({ height: '100vh', width: '100%' })
    })

    it('should be responsive', () => {
      render(<MapView />, { wrapper })
      const mapContainer = screen.getByTestId('map-view')

      expect(mapContainer).toHaveClass('w-full', 'h-full')
    })
  })

  describe('cleanup', () => {
    it('should remove map instance on unmount', async () => {
      const { unmount } = render(<MapView />, { wrapper })

      await waitFor(() => {
        expect(mockMapInstance.remove).not.toHaveBeenCalled()
      })

      unmount()

      expect(mockMapInstance.remove).toHaveBeenCalled()
    })
  })

  describe('accessibility', () => {
    it('should have accessible loading message', async () => {
      render(<MapView />, { wrapper })

      await waitFor(() => {
        const loadingText = screen.getByText(/loading map/i)
        expect(loadingText).toBeInTheDocument()
      })
    })

    it('should provide loading spinner for visual feedback', async () => {
      render(<MapView />, { wrapper })

      await waitFor(() => {
        const spinner = screen.getByTestId('map-loading').querySelector('.animate-spin')
        expect(spinner).toBeInTheDocument()
      })
    })
  })

  describe('user location marker', () => {
    it('should show loading state when getting location', async () => {
      vi.mocked(useGeolocation).mockReturnValue({
        coordinates: null,
        loading: true,
        error: null,
        manualLocation: null,
        setManualLocation: vi.fn(),
      })

      render(<MapView />, { wrapper })

      await waitFor(() => {
        expect(screen.getByTestId('location-loading')).toBeInTheDocument()
        expect(screen.getByText(/getting your location/i)).toBeInTheDocument()
      })
    })

    it('should render user location marker when coordinates are available', async () => {
      const mockCoordinates = {
        latitude: 14.5995,
        longitude: 120.9842,
      }

      vi.mocked(useGeolocation).mockReturnValue({
        coordinates: mockCoordinates,
        loading: false,
        error: null,
        manualLocation: null,
        setManualLocation: vi.fn(),
      })

      render(<MapView />, { wrapper })

      await waitFor(() => {
        expect(L.marker).toHaveBeenCalledWith(
          [mockCoordinates.latitude, mockCoordinates.longitude],
          expect.objectContaining({
            zIndexOffset: 1000,
          })
        )
        expect(L.circle).toHaveBeenCalledWith(
          [mockCoordinates.latitude, mockCoordinates.longitude],
          expect.objectContaining({
            radius: 100,
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.15,
            weight: 2,
            interactive: false,
          })
        )
      })
    })

    it('should show user location info when coordinates are available', async () => {
      vi.mocked(useGeolocation).mockReturnValue({
        coordinates: { latitude: 14.5995, longitude: 120.9842 },
        loading: false,
        error: null,
        manualLocation: null,
        setManualLocation: vi.fn(),
      })

      render(<MapView />, { wrapper })

      await waitFor(() => {
        expect(screen.getByTestId('user-location-info')).toBeInTheDocument()
        expect(screen.getByText(/your location/i)).toBeInTheDocument()
      })
    })

    it('should update marker position when location changes', async () => {
      const initialCoords = { latitude: 14.5995, longitude: 120.9842 }
      const updatedCoords = { latitude: 14.6, longitude: 120.99 }

      vi.mocked(useGeolocation).mockReturnValue({
        coordinates: initialCoords,
        loading: false,
        error: null,
        manualLocation: null,
        setManualLocation: vi.fn(),
      })

      const { rerender } = render(<MapView />, { wrapper })

      await waitFor(() => {
        expect(L.marker).toHaveBeenCalledWith(
          [initialCoords.latitude, initialCoords.longitude],
          expect.any(Object)
        )
      })

      // Update mock to return new coordinates
      vi.mocked(useGeolocation).mockReturnValue({
        coordinates: updatedCoords,
        loading: false,
        error: null,
        manualLocation: null,
        setManualLocation: vi.fn(),
      })

      rerender(<MapView />)

      await waitFor(() => {
        expect(L.marker).toHaveBeenCalledWith(
          [updatedCoords.latitude, updatedCoords.longitude],
          expect.any(Object)
        )
      })
    })

    it('should show error state when location is unavailable', async () => {
      vi.mocked(useGeolocation).mockReturnValue({
        coordinates: null,
        loading: false,
        error: 'PERMISSION_DENIED',
        manualLocation: null,
        setManualLocation: vi.fn(),
      })

      render(<MapView />, { wrapper })

      await waitFor(() => {
        expect(screen.getByTestId('location-error')).toBeInTheDocument()
        expect(screen.getByText(/location unavailable/i)).toBeInTheDocument()
        expect(
          screen.getByText(/please enable location permissions/i)
        ).toBeInTheDocument()
      })
    })

    it('should show geolocation unsupported message', async () => {
      vi.mocked(useGeolocation).mockReturnValue({
        coordinates: null,
        loading: false,
        error: 'GEOLOCATION_UNSUPPORTED',
        manualLocation: null,
        setManualLocation: vi.fn(),
      })

      render(<MapView />, { wrapper })

      await waitFor(() => {
        expect(screen.getByTestId('location-error')).toBeInTheDocument()
        expect(
          screen.getByText(/your browser does not support geolocation/i)
        ).toBeInTheDocument()
      })
    })

    it('should center map on user location when marker is clicked', async () => {
      const mockCoordinates = {
        latitude: 14.5995,
        longitude: 120.9842,
      }

      vi.mocked(useGeolocation).mockReturnValue({
        coordinates: mockCoordinates,
        loading: false,
        error: null,
        manualLocation: null,
        setManualLocation: vi.fn(),
      })

      let clickHandler: ((event: L.LeafletMouseEvent) => void) | undefined

      vi.mocked(L.marker).mockImplementation((latlng: L.LatLngExpression, options?: L.MarkerOptions) => {
        const marker = {
          addTo: vi.fn().mockReturnThis(),
          on: vi.fn((event: string, handler: () => void) => {
            if (event === 'click') {
              clickHandler = handler as () => void
            }
          }),
        }
        return marker as any
      })

      render(<MapView />, { wrapper })

      await waitFor(() => {
        expect(L.marker).toHaveBeenCalled()
      })

      // Simulate marker click
      if (clickHandler) {
        clickHandler({} as L.LeafletMouseEvent)
        expect(mockMapInstance.setView).toHaveBeenCalledWith(
          [mockCoordinates.latitude, mockCoordinates.longitude],
          15,
          { animate: true }
        )
      }
    })

    it('should add accuracy circle around user location', async () => {
      const mockCoordinates = {
        latitude: 14.5995,
        longitude: 120.9842,
      }

      vi.mocked(useGeolocation).mockReturnValue({
        coordinates: mockCoordinates,
        loading: false,
        error: null,
        manualLocation: null,
        setManualLocation: vi.fn(),
      })

      render(<MapView />, { wrapper })

      await waitFor(() => {
        expect(L.circle).toHaveBeenCalledWith(
          [mockCoordinates.latitude, mockCoordinates.longitude],
          expect.objectContaining({
            radius: 100,
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.15,
            weight: 2,
          })
        )
      })
    })

    it('should not show marker when coordinates are null', async () => {
      vi.mocked(useGeolocation).mockReturnValue({
        coordinates: null,
        loading: false,
        error: null,
        manualLocation: null,
        setManualLocation: vi.fn(),
      })

      render(<MapView />, { wrapper })

      await waitFor(() => {
        expect(screen.queryByTestId('user-location-info')).not.toBeInTheDocument()
        expect(screen.queryByTestId('location-error')).not.toBeInTheDocument()
      })
    })
  })

  describe('disaster reports', () => {
    const mockDisasterReports = [
      {
        id: 'report1',
        incidentType: 'flood' as const,
        severity: 'high' as const,
        status: 'verified',
        timestamp: Date.now() - 3600000,
        location: { latitude: 14.5995, longitude: 120.9842 },
        description: 'Heavy flooding',
      },
      {
        id: 'report2',
        incidentType: 'fire' as const,
        severity: 'medium' as const,
        status: 'assigned',
        timestamp: Date.now() - 7200000,
        location: { latitude: 14.61, longitude: 120.99 },
        description: 'Building fire',
      },
    ]

    it('should show loading indicator when fetching reports', async () => {
      vi.mocked(useDisasterReports).mockReturnValue({
        data: [],
        isLoading: true,
        error: null,
        isSuccess: false,
        isFetching: true,
      } as any)

      render(<MapView />, { wrapper })

      await waitFor(() => {
        expect(screen.getByTestId('reports-loading')).toBeInTheDocument()
        expect(screen.getByText(/loading disaster reports/i)).toBeInTheDocument()
      })
    })

    it('should render disaster report markers', async () => {
      vi.mocked(useDisasterReports).mockReturnValue({
        data: mockDisasterReports,
        isLoading: false,
        error: null,
        isSuccess: true,
        isFetching: false,
      } as any)

      render(<MapView />, { wrapper })

      await waitFor(() => {
        // Should create markers for each report
        expect(L.marker).toHaveBeenCalled()
      })
    })

    it('should create color-coded markers by severity', async () => {
      vi.mocked(useDisasterReports).mockReturnValue({
        data: mockDisasterReports,
        isLoading: false,
        error: null,
        isSuccess: true,
        isFetching: false,
      } as any)

      render(<MapView />, { wrapper })

      await waitFor(() => {
        expect(L.marker).toHaveBeenCalled()
      })

      // Check that markers are created with severity-specific icons
      expect(L.marker).toHaveBeenCalledWith(
        [14.5995, 120.9842],
        expect.objectContaining({
          icon: expect.any(Object),
        })
      )
    })

    it('should bind popups to markers', async () => {
      vi.mocked(useDisasterReports).mockReturnValue({
        data: mockDisasterReports,
        isLoading: false,
        error: null,
        isSuccess: true,
        isFetching: false,
      } as any)

      render(<MapView />, { wrapper })

      await waitFor(() => {
        expect(L.marker).toHaveBeenCalled()
      })

      // Check that markers have popups bound
      expect(mockMarker.bindPopup).toHaveBeenCalled()
    })

    it('should show error indicator when reports fail to load', async () => {
      vi.mocked(useDisasterReports).mockReturnValue({
        data: [],
        isLoading: false,
        error: new Error('Failed to fetch'),
        isSuccess: false,
        isFetching: false,
      } as any)

      render(<MapView />, { wrapper })

      await waitFor(() => {
        expect(screen.getByTestId('reports-error')).toBeInTheDocument()
        expect(screen.getByText(/failed to load disaster reports/i)).toBeInTheDocument()
      })
    })

    it('should handle empty reports array gracefully', async () => {
      vi.mocked(useDisasterReports).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        isSuccess: true,
        isFetching: false,
      } as any)

      render(<MapView />, { wrapper })

      await waitFor(() => {
        expect(screen.queryByTestId('reports-loading')).not.toBeInTheDocument()
        expect(screen.queryByTestId('reports-error')).not.toBeInTheDocument()
      })
    })
  })
})

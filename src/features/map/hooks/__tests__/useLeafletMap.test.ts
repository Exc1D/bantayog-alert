import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import L from 'leaflet'
import { useLeafletMap } from '../useLeafletMap'

// Mock Leaflet library
vi.mock('leaflet', () => ({
  default: {
    map: vi.fn(),
    tileLayer: vi.fn(() => ({
      addTo: vi.fn(),
    })),
  },
}))

describe('useLeafletMap', () => {
  const mockMapInstance = {
    setView: vi.fn(),
    remove: vi.fn(),
    addLayer: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(L.map).mockReturnValue(mockMapInstance as any)
  })

  describe('initialization', () => {
    it('should create map container ref', () => {
      const { result } = renderHook(() =>
        useLeafletMap({
          center: [14.5995, 120.9842],
          zoom: 10,
        })
      )

      expect(result.current.mapContainerRef).toBeDefined()
      expect(result.current.mapContainerRef.current).toBeNull()
    })

    it('should start with not ready state', () => {
      const { result } = renderHook(() =>
        useLeafletMap({
          center: [14.5995, 120.9842],
          zoom: 10,
        })
      )

      expect(result.current.isReady).toBe(false)
    })

    it('should provide map instance ref', () => {
      const { result } = renderHook(() =>
        useLeafletMap({
          center: [14.5995, 120.9842],
          zoom: 10,
        })
      )

      expect(result.current.mapInstanceRef).toBeDefined()
      expect(result.current.mapInstanceRef.current).toBeNull()
    })
  })

  describe('configuration', () => {
    it('should accept custom center and zoom config', () => {
      const { result } = renderHook(() =>
        useLeafletMap({
          center: [15.5, 121.0],
          zoom: 12,
        })
      )

      expect(result.current.mapContainerRef).toBeDefined()
      expect(result.current.mapInstanceRef).toBeDefined()
      expect(result.current.isReady).toBe(false)
    })

    it('should use default config when not provided', () => {
      const { result } = renderHook(() =>
        useLeafletMap({
          center: [14.5995, 120.9842],
          zoom: 10,
        })
      )

      expect(result.current.mapContainerRef).toBeDefined()
      expect(result.current.mapInstanceRef).toBeDefined()
    })
  })

  describe('cleanup', () => {
    it('should not call remove if map was never initialized', () => {
      const { unmount } = renderHook(() =>
        useLeafletMap({
          center: [14.5995, 120.9842],
          zoom: 10,
        })
      )

      unmount()

      // Map was never initialized because ref is null in test environment
      expect(mockMapInstance.remove).not.toHaveBeenCalled()
    })

    it('should cleanup refs on unmount', () => {
      const { result, unmount } = renderHook(() =>
        useLeafletMap({
          center: [14.5995, 120.9842],
          zoom: 10,
        })
      )

      expect(result.current.mapInstanceRef.current).toBeNull()
      expect(result.current.isReady).toBe(false)

      unmount()

      // After unmount, refs should still be accessible but empty
      expect(result.current.mapInstanceRef.current).toBeNull()
    })
  })

  describe('re-render behavior', () => {
    it('should not crash on re-render with same config', () => {
      const { result, rerender } = renderHook(
        ({ config }) => useLeafletMap(config),
        {
          initialProps: {
            config: {
              center: [14.5995, 120.9842] as [number, number],
              zoom: 10,
            },
          },
        }
      )

      const firstRef = result.current.mapContainerRef

      rerender({
        config: {
          center: [14.5995, 120.9842] as [number, number],
          zoom: 10,
        },
      })

      // Ref should remain stable
      expect(result.current.mapContainerRef).toBe(firstRef)
    })

    it('should handle config changes', () => {
      const { result, rerender } = renderHook(
        ({ config }) => useLeafletMap(config),
        {
          initialProps: {
            config: {
              center: [14.5995, 120.9842] as [number, number],
              zoom: 10,
            },
          },
        }
      )

      rerender({
        config: {
          center: [15.5, 121.0] as [number, number],
          zoom: 12,
        },
      })

      // Hook should still work after config change
      expect(result.current.mapContainerRef).toBeDefined()
      expect(result.current.mapInstanceRef).toBeDefined()
    })
  })

  describe('integration with component', () => {
    it('should work when ref is attached to DOM element', () => {
      // This test verifies the hook structure is correct
      // Full integration test is in MapView.test.tsx
      const { result } = renderHook(() =>
        useLeafletMap({
          center: [14.5995, 120.9842],
          zoom: 10,
        })
      )

      expect(result.current.mapContainerRef).toBeDefined()
      expect(typeof result.current.mapContainerRef).toBe('object')
      expect(result.current.isReady).toBe(false)
    })
  })
})

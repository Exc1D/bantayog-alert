import { renderHook, waitFor, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useGeolocation } from '../useGeolocation';

describe('useGeolocation', () => {
  describe('when GPS is available', () => {
    beforeEach(() => {
      // Mock navigator.geolocation
      const mockGeolocation = {
        getCurrentPosition: vi.fn(),
        watchPosition: vi.fn(),
        clearWatch: vi.fn(),
      };
      Object.defineProperty(global.navigator, 'geolocation', {
        value: mockGeolocation,
        writable: true,
      });
    });

    it('should get GPS coordinates on mount', async () => {
      const mockPosition = {
        coords: {
          latitude: 14.5995,
          longitude: 120.9842,
        },
      };

      (navigator.geolocation.getCurrentPosition as any).mockImplementation(
        (success) => Promise.resolve().then(() => success(mockPosition))
      );

      const { result } = renderHook(() => useGeolocation());

      // Initial state is loading
      expect(result.current.loading).toBe(true);
      expect(result.current.coordinates).toBeNull();
      expect(result.current.error).toBeNull();

      // After async operation completes
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.coordinates).toEqual({
        latitude: 14.5995,
        longitude: 120.9842,
      });
      expect(result.current.error).toBeNull();
    });

    it('should return coordinates correctly', async () => {
      const mockPosition = {
        coords: {
          latitude: 10.3157,
          longitude: 123.8854,
        },
      };

      (navigator.geolocation.getCurrentPosition as any).mockImplementation(
        (success) => Promise.resolve().then(() => success(mockPosition))
      );

      const { result } = renderHook(() => useGeolocation());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.coordinates).toEqual({
        latitude: 10.3157,
        longitude: 123.8854,
      });
    });
  });

  describe('when GPS permission is denied', () => {
    beforeEach(() => {
      const mockGeolocation = {
        getCurrentPosition: vi.fn(),
      };
      Object.defineProperty(global.navigator, 'geolocation', {
        value: mockGeolocation,
        writable: true,
      });
    });

    it('should set PERMISSION_DENIED error', async () => {
      const mockError = {
        code: 1, // PERMISSION_DENIED
        PERMISSION_DENIED: 1,
        message: 'User denied Geolocation',
      };

      (navigator.geolocation.getCurrentPosition as any).mockImplementation(
        (_success, error) => Promise.resolve().then(() => error(mockError))
      );

      const { result } = renderHook(() => useGeolocation());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('PERMISSION_DENIED');
      expect(result.current.coordinates).toBeNull();
    });
  });

  describe('when GPS is not supported', () => {
    beforeEach(() => {
      // Remove geolocation support
      Object.defineProperty(global.navigator, 'geolocation', {
        value: undefined,
        writable: true,
      });
    });

    it('should set GEOLOCATION_UNSUPPORTED error immediately', () => {
      const { result } = renderHook(() => useGeolocation());

      expect(result.current.error).toBe('GEOLOCATION_UNSUPPORTED');
      expect(result.current.loading).toBe(false);
      expect(result.current.coordinates).toBeNull();
    });
  });

  describe('manual location fallback', () => {
    beforeEach(() => {
      const mockGeolocation = {
        getCurrentPosition: vi.fn(),
      };
      Object.defineProperty(global.navigator, 'geolocation', {
        value: mockGeolocation,
        writable: true,
      });
    });

    it('should allow setting manual location', () => {
      const { result } = renderHook(() => useGeolocation());

      const manualLocation = {
        municipality: 'Tuguegarao City',
        barangay: 'Bagay',
      };

      act(() => {
        result.current.setManualLocation(manualLocation);
      });

      expect(result.current.manualLocation).toEqual(manualLocation);
      expect(result.current.error).toBeNull();
    });

    it('should clear error when setting manual location', async () => {
      const mockError = {
        code: 1, // PERMISSION_DENIED
        PERMISSION_DENIED: 1,
        message: 'User denied Geolocation',
      };

      (navigator.geolocation.getCurrentPosition as any).mockImplementation(
        (_success, error) => Promise.resolve().then(() => error(mockError))
      );

      const { result } = renderHook(() => useGeolocation());

      await waitFor(() => {
        expect(result.current.error).toBe('PERMISSION_DENIED');
      });

      const manualLocation = {
        municipality: 'Tuguegarao City',
        barangay: 'Bagay',
      };

      act(() => {
        result.current.setManualLocation(manualLocation);
      });

      expect(result.current.manualLocation).toEqual(manualLocation);
      expect(result.current.error).toBeNull();
    });
  });
});

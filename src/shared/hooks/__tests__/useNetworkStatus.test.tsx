import { renderHook, act } from '@testing-library/react';
import { useNetworkStatus } from '../useNetworkStatus';

describe('useNetworkStatus', () => {
  beforeEach(() => {
    // Reset navigator.onLine to default before each test
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });
  });

  it('should return online status by default', () => {
    const { result } = renderHook(() => useNetworkStatus());

    expect(result.current.isOnline).toBe(true);
  });

  it('should detect offline event', () => {
    const { result } = renderHook(() => useNetworkStatus());

    // Simulate offline event
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current.isOnline).toBe(false);
  });

  it('should detect online event after offline', () => {
    const { result } = renderHook(() => useNetworkStatus());

    // Simulate offline then online
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current.isOnline).toBe(false);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(result.current.isOnline).toBe(true);
  });

  it('should clean up event listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useNetworkStatus());

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));

    removeEventListenerSpy.mockRestore();
  });
});

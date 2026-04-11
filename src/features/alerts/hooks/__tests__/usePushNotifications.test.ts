// usePushNotifications.test.ts
import { renderHook, act } from '@testing-library/react';
import { usePushNotifications } from '../usePushNotifications';

describe('usePushNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset all mocks before each test
    delete (global as any).Notification;
    Object.defineProperty(navigator, 'serviceWorker', {
      value: undefined,
      writable: true,
      configurable: true
    });
  });

  it('returns permission status', async () => {
    const { result } = renderHook(() => usePushNotifications());
    expect(['granted', 'denied', 'default', 'prompt']).toContain(result.current.permission);
  });

  it('requests notification permission', async () => {
    // Mock global Notification and serviceWorker
    const mockRequestPermission = vi.fn().mockResolvedValue('granted');
    Object.defineProperty(global, 'Notification', {
      value: { requestPermission: mockRequestPermission },
      writable: true,
      configurable: true
    });
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: vi.fn().mockResolvedValue({}) },
      writable: true
    });

    const { result } = renderHook(() => usePushNotifications());

    await act(async () => {
      const permission = await result.current.requestPermission();
      expect(permission).toBe('granted');
    });
  });

  it('indicates when notifications are not supported', async () => {
    const { result } = renderHook(() => usePushNotifications());
    expect(result.current.isSupported).toBe(false);
  });
});
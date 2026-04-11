// firebase-messaging.test.ts
import { renderHook, act } from '@testing-library/react';
import { usePushNotifications } from '../../hooks/usePushNotifications';

describe('Firebase Messaging Setup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests notification permission on requestPermission call', async () => {
    const mockRequestPermission = vi.fn().mockResolvedValue('granted') as unknown as () => Promise<NotificationPermission>;

    // Mock the global Notification API
    Object.defineProperty(window, 'Notification', {
      value: {
        permission: 'default',
        requestPermission: mockRequestPermission,
      },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => usePushNotifications());

    await act(async () => {
      await result.current.requestPermission();
    });

    expect(mockRequestPermission).toHaveBeenCalled();
  });
});
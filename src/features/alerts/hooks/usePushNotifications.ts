// usePushNotifications.ts
import { useState, useEffect, useCallback, useMemo } from 'react';

interface UsePushNotificationsResult {
  permission: NotificationPermission | 'unsupported';
  token: string | null;
  isSupported: boolean;
  isLoading: boolean;
  error: string | null;
  requestPermission: () => Promise<NotificationPermission>;
}

function checkSupport(): boolean {
  return typeof Notification !== 'undefined' && 'serviceWorker' in navigator;
}

export function usePushNotifications(): UsePushNotificationsResult {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSupported = useMemo(() => checkSupport(), []);

  useEffect(() => {
    if (isSupported) {
      setPermission(Notification.permission);
    }
  }, [isSupported]);

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!isSupported) return 'denied';

    setIsLoading(true);
    setError(null);

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted' && navigator.serviceWorker) {
        try {
          await navigator.serviceWorker.register('/firebase-messaging-sw.js');
          // FCM token would be obtained here if using Firebase Messaging
          // For now, store a placeholder - replace with actual getToken() call
          setToken('mock-fcm-token');
        } catch (swError) {
          console.error('Service worker registration failed:', swError);
          setError('Failed to register push service. Notifications may not work.');
          // Don't fail the permission request - SW reg is non-critical
        }
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to request notification permission:', message);
      setError(message);
      return 'denied';
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  return { permission, token, isSupported, isLoading, error, requestPermission };
}
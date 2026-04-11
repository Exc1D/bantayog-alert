// usePushNotifications.ts
import { useState, useEffect, useCallback } from 'react';

interface UsePushNotificationsResult {
  permission: NotificationPermission | 'unsupported';
  token: string | null;
  isSupported: boolean;
  requestPermission: () => Promise<NotificationPermission>;
}

function checkSupport(): boolean {
  return typeof Notification !== 'undefined' && 'serviceWorker' in navigator;
}

export function usePushNotifications(): UsePushNotificationsResult {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (checkSupport()) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!checkSupport()) return 'denied';

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted' && navigator.serviceWorker) {
        await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        // FCM token would be obtained here if using Firebase Messaging
        setToken('mock-token'); // Replace with actual FCM token
      }

      return result;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return 'denied';
    }
  }, []);

  return { permission, token, isSupported: checkSupport(), requestPermission };
}
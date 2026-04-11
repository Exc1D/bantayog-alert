/**
 * Service Worker Registration Utility
 * Handles service worker registration, updates, and lifecycle events
 */

export type ServiceWorkerRegistrationStatus =
  | 'unsupported'
  | 'registered'
  | 'updated'
  | 'error';

export interface ServiceWorkerConfig {
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onError?: (error: Error) => void;
}

/**
 * Check if service workers are supported
 */
export function isServiceWorkerSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    // @ts-expect-error - importScripts is not defined in Window type but exists in service worker context
    typeof window.importScripts === 'function'
  );
}

/**
 * Register the service worker
 */
export function registerServiceWorker(
  swUrl: string = '/sw.js',
  config: ServiceWorkerConfig = {}
): Promise<ServiceWorkerRegistrationStatus> {
  if (!isServiceWorkerSupported()) {
    console.warn('[SW] Service workers are not supported');
    return Promise.resolve('unsupported');
  }

  return navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      console.log('[SW] Service worker registered:', registration);

      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;

        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content is available; notify the user
              console.log('[SW] New service worker available');
              config.onUpdate?.(registration);
            } else if (newWorker.state === 'installed') {
              // Content is cached for offline use
              console.log('[SW] Service worker cached successfully');
              config.onSuccess?.(registration);
            }
          });
        }
      });

      // Trigger update check
      registration.update();

      return 'registered' as ServiceWorkerRegistrationStatus;
    })
    .catch((error) => {
      console.error('[SW] Service worker registration failed:', error);
      config.onError?.(error as Error);
      return 'error' as ServiceWorkerRegistrationStatus;
    });
}

/**
 * Unregister the service worker
 */
export function unregisterServiceWorker(): Promise<boolean> {
  if (!isServiceWorkerSupported()) {
    return Promise.resolve(false);
  }

  return navigator.serviceWorker
    .getRegistration()
    .then((registration) => {
      if (registration) {
        return registration
          .unregister()
          .then((success) => {
            console.log('[SW] Service worker unregistered:', success);
            return success;
          })
          .catch((error) => {
            console.error('[SW] Failed to unregister service worker:', error);
            return false;
          });
      }
      return false;
    })
    .catch((error) => {
      console.error('[SW] Error getting registration:', error);
      return false;
    });
}

/**
 * Skip waiting and activate the new service worker immediately
 */
export function skipWaiting(): void {
  if (!isServiceWorkerSupported()) {
    return;
  }

  navigator.serviceWorker.getRegistration().then((registration) => {
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  });
}

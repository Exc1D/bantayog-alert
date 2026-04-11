/**
 * Tests for service worker registration utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isServiceWorkerSupported,
  registerServiceWorker,
  unregisterServiceWorker,
  skipWaiting,
  type ServiceWorkerConfig,
} from '../serviceWorkerRegistration';

// Mock navigator.serviceWorker
const mockServiceWorker = {
  register: vi.fn(),
  getRegistration: vi.fn(),
};

// Mock navigator
const mockNavigator = {
  serviceWorker: mockServiceWorker,
};

// Mock window
const mockWindow = {
  importScripts: vi.fn(),
};

// Store original values
let originalNavigator: typeof navigator;
let originalWindow: typeof window;

describe('serviceWorkerRegistration', () => {
  beforeEach(() => {
    // Store originals
    originalNavigator = global.navigator;
    originalWindow = global.window;

    // Setup mocks
    Object.defineProperty(global, 'navigator', {
      value: mockNavigator,
      writable: true,
    });
    Object.defineProperty(global, 'window', {
      value: mockWindow,
      writable: true,
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore originals
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
    });
    Object.defineProperty(global, 'window', {
      value: originalWindow,
      writable: true,
    });
  });

  describe('isServiceWorkerSupported', () => {
    it('should return true when service worker is supported', () => {
      expect(isServiceWorkerSupported()).toBe(true);
    });

    it('should return false when service worker is not supported', () => {
      Object.defineProperty(global, 'navigator', {
        value: {},
        writable: true,
      });
      expect(isServiceWorkerSupported()).toBe(false);
    });

    it('should return false when window is undefined', () => {
      Object.defineProperty(global, 'window', {
        value: undefined,
        writable: true,
      });
      expect(isServiceWorkerSupported()).toBe(false);
    });

    it('should return false when importScripts is not available', () => {
      Object.defineProperty(global, 'window', {
        value: {},
        writable: true,
      });
      expect(isServiceWorkerSupported()).toBe(false);
    });
  });

  describe('registerServiceWorker', () => {
    it('should return "unsupported" when service worker is not supported', async () => {
      Object.defineProperty(global, 'navigator', {
        value: {},
        writable: true,
      });

      const result = await registerServiceWorker('/sw.js');
      expect(result).toBe('unsupported');
    });

    it('should register service worker successfully', async () => {
      const mockRegistration = {
        addEventListener: vi.fn(),
        update: vi.fn(),
      };

      mockServiceWorker.register.mockResolvedValue(mockRegistration);

      const config: ServiceWorkerConfig = {
        onSuccess: vi.fn(),
        onUpdate: vi.fn(),
        onError: vi.fn(),
      };

      const result = await registerServiceWorker('/sw.js', config);

      expect(result).toBe('registered');
      expect(mockServiceWorker.register).toHaveBeenCalledWith('/sw.js');
      expect(config.onSuccess).not.toHaveBeenCalled();
      expect(config.onUpdate).not.toHaveBeenCalled();
      expect(config.onError).not.toHaveBeenCalled();
    });

    it('should call onSuccess when content is cached', async () => {
      const mockRegistration = {
        addEventListener: vi.fn((event, handler) => {
          if (event === 'updatefound') {
            // Simulate updatefound event
            setTimeout(() => {
              const mockWorker = {
                addEventListener: vi.fn((event, handler) => {
                  if (event === 'statechange') {
                    // Simulate installed state (no controller)
                    setTimeout(() => {
                      Object.defineProperty(mockWorker, 'state', {
                        value: 'installed',
                        writable: true,
                      });
                      handler();
                    }, 0);
                  }
                }),
                state: 'installing',
              };

              Object.defineProperty(mockRegistration, 'installing', {
                value: mockWorker,
                writable: true,
              });
              handler();
            }, 0);
          }
        }),
        update: vi.fn(),
      };

      mockServiceWorker.register.mockResolvedValue(mockRegistration);

      const config: ServiceWorkerConfig = {
        onSuccess: vi.fn(),
      };

      await registerServiceWorker('/sw.js', config);

      // Wait for async callbacks
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(config.onSuccess).toHaveBeenCalledWith(mockRegistration);
    });

    it('should call onUpdate when new content is available', async () => {
      const mockRegistration = {
        addEventListener: vi.fn((event, handler) => {
          if (event === 'updatefound') {
            // Simulate updatefound event with controller
            setTimeout(() => {
              const mockWorker = {
                addEventListener: vi.fn((event, handler) => {
                  if (event === 'statechange') {
                    // Simulate installed state with controller (update available)
                    setTimeout(() => {
                      Object.defineProperty(mockWorker, 'state', {
                        value: 'installed',
                        writable: true,
                      });
                      Object.defineProperty(mockNavigator, 'serviceWorker', {
                        value: {
                          ...mockServiceWorker,
                          controller: {}, // Controller exists
                        },
                        writable: true,
                      });
                      handler();
                    }, 0);
                  }
                }),
                state: 'installing',
              };

              Object.defineProperty(mockRegistration, 'installing', {
                value: mockWorker,
                writable: true,
              });
              handler();
            }, 0);
          }
        }),
        update: vi.fn(),
      };

      mockServiceWorker.register.mockResolvedValue(mockRegistration);

      const config: ServiceWorkerConfig = {
        onUpdate: vi.fn(),
      };

      await registerServiceWorker('/sw.js', config);

      // Wait for async callbacks
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(config.onUpdate).toHaveBeenCalledWith(mockRegistration);
    });

    it('should call onError when registration fails', async () => {
      const error = new Error('Registration failed');
      mockServiceWorker.register.mockRejectedValue(error);

      const config: ServiceWorkerConfig = {
        onError: vi.fn(),
      };

      const result = await registerServiceWorker('/sw.js', config);

      expect(result).toBe('error');
      expect(config.onError).toHaveBeenCalledWith(error);
    });

    it('should call update() after registration', async () => {
      const mockRegistration = {
        addEventListener: vi.fn(),
        update: vi.fn(),
      };

      mockServiceWorker.register.mockResolvedValue(mockRegistration);

      await registerServiceWorker('/sw.js');

      expect(mockRegistration.update).toHaveBeenCalled();
    });

    it('should use default sw.js URL if not provided', async () => {
      const mockRegistration = {
        addEventListener: vi.fn(),
        update: vi.fn(),
      };

      mockServiceWorker.register.mockResolvedValue(mockRegistration);

      await registerServiceWorker();

      expect(mockServiceWorker.register).toHaveBeenCalledWith('/sw.js');
    });
  });

  describe('unregisterServiceWorker', () => {
    it('should return false when service worker is not supported', async () => {
      Object.defineProperty(global, 'navigator', {
        value: {},
        writable: true,
      });

      const result = await unregisterServiceWorker();
      expect(result).toBe(false);
    });

    it('should unregister service worker successfully', async () => {
      const mockRegistration = {
        unregister: vi.fn().mockResolvedValue(true),
      };

      mockServiceWorker.getRegistration.mockResolvedValue(mockRegistration);

      const result = await unregisterServiceWorker();

      expect(result).toBe(true);
      expect(mockRegistration.unregister).toHaveBeenCalled();
    });

    it('should return false when no registration exists', async () => {
      mockServiceWorker.getRegistration.mockResolvedValue(undefined);

      const result = await unregisterServiceWorker();

      expect(result).toBe(false);
    });

    it('should return false when getRegistration fails', async () => {
      mockServiceWorker.getRegistration.mockRejectedValue(new Error('Failed'));

      const result = await unregisterServiceWorker();

      expect(result).toBe(false);
    });

    it('should return false when unregister fails', async () => {
      const mockRegistration = {
        unregister: vi.fn().mockRejectedValue(new Error('Failed to unregister')),
      };

      mockServiceWorker.getRegistration.mockResolvedValue(mockRegistration);

      const result = await unregisterServiceWorker();

      expect(result).toBe(false);
    });
  });

  describe('skipWaiting', () => {
    it('should do nothing when service worker is not supported', () => {
      Object.defineProperty(global, 'navigator', {
        value: {},
        writable: true,
      });

      expect(() => skipWaiting()).not.toThrow();
    });

    it('should post SKIP_WAITING message to waiting worker', async () => {
      const mockWaitingWorker = {
        postMessage: vi.fn(),
      };

      const mockRegistration = {
        waiting: mockWaitingWorker,
      };

      mockServiceWorker.getRegistration.mockResolvedValue(mockRegistration);

      skipWaiting();

      // Wait for promise to resolve
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockWaitingWorker.postMessage).toHaveBeenCalledWith({
        type: 'SKIP_WAITING',
      });
    });

    it('should not post message when no waiting worker', async () => {
      const mockRegistration = {
        waiting: null,
      };

      mockServiceWorker.getRegistration.mockResolvedValue(mockRegistration);

      skipWaiting();

      // Wait for promise to resolve
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockServiceWorker.getRegistration).toHaveBeenCalled();
    });
  });
});

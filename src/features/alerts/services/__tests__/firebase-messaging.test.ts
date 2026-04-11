// firebase-messaging.test.ts
import * as fs from 'fs';
import * as path from 'path';

describe('Firebase Messaging Service Worker', () => {
  const swFilePath = path.resolve(process.cwd(), 'public/firebase-messaging-sw.js');
  let swContent: string;

  beforeAll(() => {
    expect(fs.existsSync(swFilePath), `Service worker file not found at ${swFilePath}`).toBe(true);
    swContent = fs.readFileSync(swFilePath, 'utf-8');
  });

  describe('File Existence', () => {
    it('should exist at public/firebase-messaging-sw.js', () => {
      expect(fs.existsSync(swFilePath)).toBe(true);
    });
  });

  describe('Firebase SDK Loading', () => {
    it('should load Firebase App compat SDK via importScripts', () => {
      expect(swContent).toContain('importScripts');
      expect(swContent).toContain('firebase-app-compat.js');
    });

    it('should load Firebase Messaging compat SDK via importScripts', () => {
      expect(swContent).toContain('firebase-messaging-compat.js');
    });
  });

  describe('Firebase Initialization', () => {
    it('should initialize Firebase app', () => {
      expect(swContent).toContain('firebase.initializeApp');
    });

    it('should get messaging instance', () => {
      expect(swContent).toContain('firebase.messaging()');
    });
  });

  describe('Background Message Handler', () => {
    it('should register onBackgroundMessage handler', () => {
      expect(swContent).toContain('onBackgroundMessage');
    });

    it('should set notification title from payload', () => {
      expect(swContent).toContain('payload.notification?.title');
    });

    it('should set notification body from payload', () => {
      expect(swContent).toContain('payload.notification?.body');
    });

    it('should show notification using self.registration', () => {
      expect(swContent).toContain('self.registration.showNotification');
    });
  });

  describe('Notification Click Handler', () => {
    it('should add notificationclick event listener', () => {
      expect(swContent).toContain('notificationclick');
      expect(swContent).toContain('addEventListener');
    });

    it('should close notification on click', () => {
      expect(swContent).toContain('event.notification.close()');
    });

    it('should open alerts page when view action is triggered', () => {
      expect(swContent).toContain("clients.openWindow('/?tab=alerts')");
    });
  });
});

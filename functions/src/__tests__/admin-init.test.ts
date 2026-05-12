import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('admin-init', () => {
  const originalVitest = process.env.VITEST
  const originalEmulatorHost = process.env.FIREBASE_DATABASE_EMULATOR_HOST

  beforeEach(() => {
    vi.resetModules()
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (originalVitest === undefined) {
      delete process.env.VITEST
    } else {
      process.env.VITEST = originalVitest
    }
    if (originalEmulatorHost === undefined) {
      delete process.env.FIREBASE_DATABASE_EMULATOR_HOST
    } else {
      process.env.FIREBASE_DATABASE_EMULATOR_HOST = originalEmulatorHost
    }
  })

  it('falls back to ADC when no Firebase app exists and VITEST is unset', async () => {
    const initializeAppMock = vi.fn(() => ({ name: '[DEFAULT]' }))
    vi.doMock('firebase-admin/app', () => ({
      getApps: vi.fn(() => []),
      initializeApp: initializeAppMock,
    }))
    vi.doMock('firebase-admin/auth', () => ({
      getAuth: vi.fn(() => ({})),
    }))
    vi.doMock('firebase-admin/firestore', () => ({
      getFirestore: vi.fn(() => ({})),
    }))
    vi.doMock('firebase-admin/database', () => ({
      getDatabase: vi.fn(() => ({})),
    }))

    delete process.env.VITEST

    await import('../admin-init.js')

    // No throw, and initializeApp called with undefined so the SDK falls back
    // to FIREBASE_CONFIG / Application Default Credentials.
    expect(initializeAppMock).toHaveBeenCalledWith(undefined)
  })

  it('uses FIREBASE_DATABASE_EMULATOR_HOST when VITEST is set and an emulator host is configured', async () => {
    const initializeAppMock = vi.fn(() => ({ name: '[DEFAULT]' }))
    vi.doMock('firebase-admin/app', () => ({
      getApps: vi.fn(() => []),
      initializeApp: initializeAppMock,
    }))
    vi.doMock('firebase-admin/auth', () => ({
      getAuth: vi.fn(() => ({})),
    }))
    vi.doMock('firebase-admin/firestore', () => ({
      getFirestore: vi.fn(() => ({})),
    }))
    vi.doMock('firebase-admin/database', () => ({
      getDatabase: vi.fn(() => ({})),
    }))

    process.env.VITEST = 'true'
    process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9000'

    await import('../admin-init.js')

    expect(initializeAppMock).toHaveBeenCalledWith({
      databaseURL: 'http://127.0.0.1:9000?ns=demo',
    })
    expect(console.warn).toHaveBeenCalledWith(
      '[admin-init] VITEST mode: using dummy RTDB URL. Emulator must be running.',
    )
  })

  it('defaults to 127.0.0.1:9000 when VITEST is set but FIREBASE_DATABASE_EMULATOR_HOST is unset', async () => {
    const initializeAppMock = vi.fn(() => ({ name: '[DEFAULT]' }))
    vi.doMock('firebase-admin/app', () => ({
      getApps: vi.fn(() => []),
      initializeApp: initializeAppMock,
    }))
    vi.doMock('firebase-admin/auth', () => ({
      getAuth: vi.fn(() => ({})),
    }))
    vi.doMock('firebase-admin/firestore', () => ({
      getFirestore: vi.fn(() => ({})),
    }))
    vi.doMock('firebase-admin/database', () => ({
      getDatabase: vi.fn(() => ({})),
    }))

    process.env.VITEST = 'true'
    delete process.env.FIREBASE_DATABASE_EMULATOR_HOST

    await import('../admin-init.js')

    expect(initializeAppMock).toHaveBeenCalledWith({
      databaseURL: 'http://127.0.0.1:9000?ns=demo',
    })
  })
})

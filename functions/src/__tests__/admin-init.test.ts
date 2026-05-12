import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('admin-init', () => {
  const originalVitest = process.env.VITEST

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
  })

  it('throws when no Firebase app exists and VITEST is unset', async () => {
    // Mock initializeApp to succeed even with undefined — simulating the real
    // Firebase SDK, which does NOT throw on undefined but creates a broken app.
    vi.doMock('firebase-admin/app', () => ({
      getApps: vi.fn(() => []),
      initializeApp: vi.fn(() => ({ name: '[DEFAULT]' })),
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

    await expect(import('../admin-init.js')).rejects.toThrow('Firebase Admin not configured')
  })

  it('warns when VITEST is set and no app exists', async () => {
    vi.doMock('firebase-admin/app', () => ({
      getApps: vi.fn(() => []),
      initializeApp: vi.fn(() => ({ name: '[DEFAULT]' })),
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

    await import('../admin-init.js')

    expect(console.warn).toHaveBeenCalledWith(
      '[admin-init] VITEST mode: using dummy RTDB URL. Emulator must be running.',
    )
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const firebaseAuthMock = vi.hoisted(() => ({
  browserLocalPersistence: { type: 'LOCAL' },
  setPersistence: vi.fn(),
  signInAnonymously: vi.fn(),
}))

vi.mock('firebase/auth', () => ({
  browserLocalPersistence: firebaseAuthMock.browserLocalPersistence,
  getAuth: vi.fn(),
  onAuthStateChanged: vi.fn(),
  setPersistence: firebaseAuthMock.setPersistence,
  signInAnonymously: firebaseAuthMock.signInAnonymously,
}))

import { ensurePseudonymousSignIn } from './auth.js'

describe('ensurePseudonymousSignIn', () => {
  beforeEach(() => {
    firebaseAuthMock.setPersistence.mockReset()
    firebaseAuthMock.signInAnonymously.mockReset()
  })

  it('reuses an existing user without creating another anonymous account', async () => {
    const user = { uid: 'existing-anon' }

    await expect(ensurePseudonymousSignIn({ currentUser: user } as never)).resolves.toBe(user)

    expect(firebaseAuthMock.setPersistence).not.toHaveBeenCalled()
    expect(firebaseAuthMock.signInAnonymously).not.toHaveBeenCalled()
  })

  it('sets browser-local persistence before anonymous sign-in', async () => {
    const user = { uid: 'new-anon' }
    const auth = { currentUser: null }
    firebaseAuthMock.setPersistence.mockResolvedValue(undefined)
    firebaseAuthMock.signInAnonymously.mockResolvedValue({ user })

    await expect(ensurePseudonymousSignIn(auth as never)).resolves.toBe(user)

    expect(firebaseAuthMock.setPersistence).toHaveBeenCalledWith(
      auth,
      firebaseAuthMock.browserLocalPersistence,
    )
    expect(firebaseAuthMock.signInAnonymously).toHaveBeenCalledWith(auth)
  })

  it('still signs in when browser-local persistence is unavailable', async () => {
    const user = { uid: 'fallback-anon' }
    const auth = { currentUser: null }
    firebaseAuthMock.setPersistence.mockRejectedValue(new Error('storage unavailable'))
    firebaseAuthMock.signInAnonymously.mockResolvedValue({ user })

    await expect(ensurePseudonymousSignIn(auth as never)).resolves.toBe(user)

    expect(firebaseAuthMock.signInAnonymously).toHaveBeenCalledWith(auth)
  })
})

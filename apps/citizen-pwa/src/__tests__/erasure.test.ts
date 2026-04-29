import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockCallable, mockSignOut } = vi.hoisted(() => ({
  mockCallable: vi.fn(),
  mockSignOut: vi.fn(),
}))
vi.mock('../services/firebase.js', () => ({
  fns: vi.fn(),
  auth: vi.fn(),
  httpsCallable: () => mockCallable,
}))
vi.mock('firebase/auth', () => ({ signOut: mockSignOut }))

import { requestDataErasureAndSignOut } from '../services/erasure.js'

beforeEach(() => {
  mockCallable.mockClear()
  mockSignOut.mockClear()
  mockCallable.mockResolvedValue({ data: {} })
  mockSignOut.mockResolvedValue(undefined)
})

describe('requestDataErasureAndSignOut', () => {
  it('calls requestDataErasure callable then signOut', async () => {
    await requestDataErasureAndSignOut()
    expect(mockCallable).toHaveBeenCalledWith({})
    expect(mockSignOut).toHaveBeenCalled()
  })

  it('throws if callable fails without calling signOut', async () => {
    mockCallable.mockRejectedValueOnce({ code: 'internal' })
    await expect(requestDataErasureAndSignOut()).rejects.toMatchObject({ code: 'internal' })
    expect(mockSignOut).not.toHaveBeenCalled()
  })

  it('still calls signOut if already-exists error (prior request pending)', async () => {
    mockCallable.mockRejectedValueOnce({ code: 'already-exists' })
    // already-exists means a prior request is in-flight; treat as success
    // so the user is signed out and the UI transitions to goodbye
    await requestDataErasureAndSignOut()
    expect(mockSignOut).toHaveBeenCalled()
  })
})

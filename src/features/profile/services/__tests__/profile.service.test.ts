import { describe, it, expect, vi } from 'vitest'
import { deleteUserAccount } from '../profile.service'

const callFunctionMock = vi.hoisted(() => vi.fn())
vi.mock('@/shared/services/functions.service', () => ({
  callFunction: callFunctionMock,
}))

// Prevent firebase initialization errors in test environment
vi.mock('@/app/firebase/config', () => ({
  db: {},
  auth: {},
  functions: {},
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({}),
  query: vi.fn().mockReturnValue({}),
  where: vi.fn().mockReturnValue({}),
  orderBy: vi.fn().mockReturnValue({}),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
}))

describe('deleteUserAccount', () => {
  it('delegates to deleteUserData callable instead of direct Firestore deletes', async () => {
    callFunctionMock.mockResolvedValue({ success: true })

    await deleteUserAccount('user-123')

    expect(callFunctionMock).toHaveBeenCalledWith('deleteUserData', { targetUserUid: 'user-123' })
  })

  it('wraps callable errors with a user-friendly message', async () => {
    callFunctionMock.mockRejectedValue(new Error('Network error'))

    await expect(deleteUserAccount('user-123')).rejects.toThrow('Failed to delete account')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as test from 'firebase-functions-test'
import { deleteUserData } from './index'

// All mock functions are created with vi.hoisted() so they are available
// at module initialization time (before vi.mock hoisting runs).
const {
  firestoreCollectionMock,
  authDeleteUserMock,
  reportPrivateQueryMock,
  reportOpsDocDeleteMock,
  usersDocDeleteMock,
  rolesDocGetMock,
  rolesDocDeleteMock,
  auditAddMock,
} = vi.hoisted(() => {
  const authDeleteUserMock = vi.fn().mockResolvedValue(undefined)

  // report_private query mock — returns empty docs by default (Test 5)
  const reportPrivateQueryMock = vi.fn().mockResolvedValue({ docs: [] })

  const reportOpsDocDeleteMock = vi.fn().mockResolvedValue(undefined)
  const usersDocDeleteMock = vi.fn().mockResolvedValue(undefined)
  const rolesDocGetMock = vi.fn().mockResolvedValue({ exists: false })
  const rolesDocDeleteMock = vi.fn().mockResolvedValue(undefined)
  const auditAddMock = vi.fn().mockResolvedValue({ id: 'audit-doc-id' })

  // Default firestore collection mock — uses a switch based on collection name
  const firestoreCollectionMock = vi.fn((collection: string) => {
    switch (collection) {
      case 'users':
        return {
          doc: vi.fn().mockReturnValue({ delete: usersDocDeleteMock }),
        }
      case 'roles':
        return {
          doc: vi.fn().mockReturnValue({
            get: rolesDocGetMock,
            delete: rolesDocDeleteMock,
          }),
        }
      case 'report_private': {
        // Build fresh chain each call so state is clean between tests
        const whereMock = vi.fn().mockReturnValue({ get: reportPrivateQueryMock })
        return { where: whereMock }
      }
      case 'report_ops':
        return {
          doc: vi.fn().mockReturnValue({ delete: reportOpsDocDeleteMock }),
        }
      case 'audit_logs':
        return { add: auditAddMock }
      default:
        return {}
    }
  })

  return {
    firestoreCollectionMock,
    authDeleteUserMock,
    reportPrivateQueryMock,
    reportOpsDocDeleteMock,
    usersDocDeleteMock,
    rolesDocGetMock,
    rolesDocDeleteMock,
    auditAddMock,
  }
})

vi.mock('firebase-admin', () => ({
  initializeApp: vi.fn(),
  auth: vi.fn(() => ({
    deleteUser: authDeleteUserMock,
  })),
  firestore: vi.fn(() => ({
    collection: firestoreCollectionMock,
  })),
}))

// firebase-functions-test must be initialized after vi.mock
const ft = test.default()
const wrap = ft.wrap

// Helper to reset all shared mocks between tests
function resetSharedMocks() {
  authDeleteUserMock.mockClear()
  authDeleteUserMock.mockResolvedValue(undefined)
  reportPrivateQueryMock.mockClear()
  reportPrivateQueryMock.mockResolvedValue({ docs: [] })
  rolesDocGetMock.mockClear()
  rolesDocGetMock.mockResolvedValue({ exists: false })
  auditAddMock.mockClear()
  auditAddMock.mockResolvedValue({ id: 'audit-doc-id' })
  reportOpsDocDeleteMock.mockClear()
  usersDocDeleteMock.mockClear()
  rolesDocDeleteMock.mockClear()
}

describe('deleteUserData', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // Test 1: Unauthenticated call → throws 'unauthenticated' error
  // ─────────────────────────────────────────────────────────────────────────
  it('rejects unauthenticated request with unauthenticated error', async () => {
    resetSharedMocks()
    await expect(
      wrap(deleteUserData)({ targetUserUid: 'some-uid' }, { auth: undefined })
    ).rejects.toMatchObject({
      code: 'unauthenticated',
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 2: User deletes own account → deletes auth, users, roles,
  //          report_private, report_ops; no audit log written
  // ─────────────────────────────────────────────────────────────────────────
  it('deletes own account without writing audit log', async () => {
    resetSharedMocks()

    const userContext = {
      auth: {
        uid: 'user-1',
        token: { role: 'citizen' },
      },
    }

    const result = await wrap(deleteUserData)(
      { targetUserUid: 'user-1' },
      userContext
    )

    expect(result).toEqual({
      success: true,
      message: 'User data deleted successfully',
    })

    // Auth deleted
    expect(authDeleteUserMock).toHaveBeenCalledWith('user-1')

    // Users doc deleted
    expect(usersDocDeleteMock).toHaveBeenCalled()

    // Audit log NOT written (deleting own account)
    expect(auditAddMock).not.toHaveBeenCalled()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 3: Superadmin deletes other user → same as #2 + writes audit_log entry
  // ─────────────────────────────────────────────────────────────────────────
  it('superadmin deleting other user writes audit log', async () => {
    resetSharedMocks()

    // Simulate caller profile lookup (users collection returns superadmin profile)
    const callerDocGetMock = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({ role: 'provincial_superadmin' }),
    })
    const rolesDocGetMockForCaller = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({ role: 'provincial_superadmin' }),
    })

    // Patch firestoreCollectionMock to return caller profile on permission check
    // This overrides the default switch behavior for the duration of this test
    firestoreCollectionMock.mockImplementation((collection: string) => {
      if (collection === 'users') {
        return {
          doc: vi.fn().mockReturnValue({
            get: callerDocGetMock,
            delete: usersDocDeleteMock,
          }),
        }
      }
      if (collection === 'roles') {
        return {
          doc: vi.fn().mockReturnValue({
            get: rolesDocGetMockForCaller,
            delete: rolesDocDeleteMock,
          }),
        }
      }
      if (collection === 'report_private') {
        const whereMock = vi.fn().mockReturnValue({ get: reportPrivateQueryMock })
        return { where: whereMock }
      }
      if (collection === 'report_ops') {
        return {
          doc: vi.fn().mockReturnValue({ delete: reportOpsDocDeleteMock }),
        }
      }
      if (collection === 'audit_logs') {
        return { add: auditAddMock }
      }
      return {}
    })

    const superadminContext = {
      auth: {
        uid: 'superadmin-1',
        token: { role: 'provincial_superadmin' },
      },
    }

    const result = await wrap(deleteUserData)(
      { targetUserUid: 'target-user-1' },
      superadminContext
    )

    expect(result).toEqual({
      success: true,
      message: 'User data deleted successfully',
    })

    // Auth deleted
    expect(authDeleteUserMock).toHaveBeenCalledWith('target-user-1')

    // Audit log written
    expect(auditAddMock).toHaveBeenCalledTimes(1)
    const auditEntry = auditAddMock.mock.calls[0][0]
    expect(auditEntry).toMatchObject({
      performedBy: 'superadmin-1',
      performedByRole: 'provincial_superadmin',
      action: 'DELETE_USER',
      resourceType: 'user',
      resourceId: 'target-user-1',
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 4: Non-admin deletes other user → throws 'permission-denied' error
  //          (caller profile lookup returns citizen role → role !== superadmin)
  // ─────────────────────────────────────────────────────────────────────────
  it('rejects non-admin deleting other user with permission-denied error', async () => {
    resetSharedMocks()

    // Simulate caller profile lookup (users collection returns citizen profile)
    const callerDocGetMock = vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({ role: 'citizen' }),
    })

    // Patch firestoreCollectionMock to return caller profile on permission check
    firestoreCollectionMock.mockImplementation((collection: string) => {
      if (collection === 'users') {
        return {
          doc: vi.fn().mockReturnValue({
            get: callerDocGetMock,
            delete: usersDocDeleteMock,
          }),
        }
      }
      if (collection === 'roles') {
        return {
          doc: vi.fn().mockReturnValue({
            get: rolesDocGetMock,
            delete: rolesDocDeleteMock,
          }),
        }
      }
      if (collection === 'report_private') {
        const whereMock = vi.fn().mockReturnValue({ get: reportPrivateQueryMock })
        return { where: whereMock }
      }
      if (collection === 'report_ops') {
        return {
          doc: vi.fn().mockReturnValue({ delete: reportOpsDocDeleteMock }),
        }
      }
      if (collection === 'audit_logs') {
        return { add: auditAddMock }
      }
      return {}
    })

    const citizenContext = {
      auth: {
        uid: 'citizen-1',
        token: { role: 'citizen' },
      },
    }

    await expect(
      wrap(deleteUserData)({ targetUserUid: 'other-user' }, citizenContext)
    ).rejects.toMatchObject({
      code: 'permission-denied',
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 5: User with no report_private records → succeeds gracefully
  //          (empty docs array returned from query, no report_ops deletions)
  // ─────────────────────────────────────────────────────────────────────────
  it('succeeds gracefully when user has no report_private records', async () => {
    resetSharedMocks()

    const userContext = {
      auth: {
        uid: 'lonely-user',
        token: { role: 'citizen' },
      },
    }

    const result = await wrap(deleteUserData)(
      { targetUserUid: 'lonely-user' },
      userContext
    )

    expect(result).toEqual({
      success: true,
      message: 'User data deleted successfully',
    })

    // Auth deleted
    expect(authDeleteUserMock).toHaveBeenCalledWith('lonely-user')

    // Users doc deleted
    expect(usersDocDeleteMock).toHaveBeenCalled()

    // No audit log (deleting own account)
    expect(auditAddMock).not.toHaveBeenCalled()
  })
})
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as test from 'firebase-functions-test'
import { createAlert } from './createAlert'

// All variables used inside vi.mock factories must be created with vi.hoisted()
// so they are available at module-initialization time (before vi.mock hoisting runs).
const { firestoreAddMock, firestoreCollectionMock } = vi.hoisted(() => {
  const firestoreAddMock = vi.fn().mockResolvedValue({ id: 'alert-doc-id' })
  const firestoreCollectionMock = vi.fn().mockReturnValue({
    add: firestoreAddMock,
  })
  return { firestoreAddMock, firestoreCollectionMock }
})

vi.mock('firebase-admin', () => ({
  initializeApp: vi.fn(),
  auth: vi.fn(),
  firestore: vi.fn(() => ({
    collection: firestoreCollectionMock,
  })),
}))

// firebase-functions-test must be initialized after vi.mock
const ft = test.default()
const wrap = ft.wrap

beforeEach(() => {
  vi.clearAllMocks()
  firestoreAddMock.mockResolvedValue({ id: 'alert-doc-id' })
  firestoreCollectionMock.mockReturnValue({
    add: firestoreAddMock,
  })
})

describe('createAlert', () => {
  const validData = {
    title: 'Flood Warning',
    message: 'Rising water levels in low-lying areas',
    severity: 'warning',
    type: 'weather',
    affectedAreas: { municipalities: ['Daet'] },
    source: 'MDRRMO',
  }

  const superadminContext = {
    auth: {
      uid: 'superadmin-1',
      token: {
        role: 'provincial_superadmin',
        municipality: undefined,
      },
    },
  }

  const municipalAdminContext = (municipality: string) => ({
    auth: {
      uid: 'municipal-admin-1',
      token: {
        role: 'municipal_admin',
        municipality,
      },
    },
  })

  const citizenContext = {
    auth: {
      uid: 'citizen-1',
      token: {
        role: 'citizen',
        municipality: undefined,
      },
    },
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Test 1: Unauthenticated request → 'unauthenticated' error
  // ─────────────────────────────────────────────────────────────────────────
  it('rejects unauthenticated request with unauthenticated error', async () => {
    await expect(
      wrap(createAlert)(validData, { auth: undefined })
    ).rejects.toMatchObject({
      code: 'unauthenticated',
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 2: Non-admin role → 'permission-denied' error
  // ─────────────────────────────────────────────────────────────────────────
  it('rejects non-admin role with permission-denied error', async () => {
    await expect(
      wrap(createAlert)(validData, citizenContext)
    ).rejects.toMatchObject({
      code: 'permission-denied',
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 3: Municipal admin creating for wrong municipality → 'invalid-argument'
  // ─────────────────────────────────────────────────────────────────────────
  it('rejects municipal admin creating for different municipality', async () => {
    await expect(
      wrap(createAlert)(
        { ...validData, targetMunicipality: 'Labo' },
        municipalAdminContext('Daet')
      )
    ).rejects.toMatchObject({
      code: 'invalid-argument',
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 4: Missing required fields → 'invalid-argument'
  // ─────────────────────────────────────────────────────────────────────────
  it('rejects missing required fields with invalid-argument error', async () => {
    await expect(
      wrap(createAlert)(
        { title: 'Only Title' },
        superadminContext
      )
    ).rejects.toMatchObject({
      code: 'invalid-argument',
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 5: Happy path → creates alert + audit log
  // ─────────────────────────────────────────────────────────────────────────
  it('creates alert document and audit log when called by superadmin', async () => {
    const result = await wrap(createAlert)(validData, superadminContext)

    expect(result).toEqual({ id: 'alert-doc-id' })

    // Verify alerts collection was called first, then audit_logs
    expect(firestoreCollectionMock).toHaveBeenCalledWith('alerts')
    expect(firestoreCollectionMock).toHaveBeenCalledWith('audit_logs')
    expect(firestoreCollectionMock).toHaveBeenCalledTimes(2)

    // Check the data written to alerts (first add call)
    const alertData = firestoreAddMock.mock.calls[0][0]
    expect(alertData).toMatchObject({
      title: 'Flood Warning',
      message: 'Rising water levels in low-lying areas',
      severity: 'warning',
      createdBy: 'superadmin-1',
      isActive: true,
    })
    expect(alertData.createdAt).toBeLessThanOrEqual(Date.now())

    // Check the audit log entry (second add call)
    const auditData = firestoreAddMock.mock.calls[1][0]
    expect(auditData).toMatchObject({
      performedBy: 'superadmin-1',
      performedByRole: 'provincial_superadmin',
      action: 'CREATE_ALERT',
      resourceType: 'alert',
      resourceId: 'alert-doc-id',
      details: 'Created alert: Flood Warning',
    })
  })

  it('allows municipal admin to create alert for their own municipality', async () => {
    const result = await wrap(createAlert)(
      { ...validData, targetMunicipality: 'Daet' },
      municipalAdminContext('Daet')
    )

    expect(result).toEqual({ id: 'alert-doc-id' })
    expect(firestoreAddMock).toHaveBeenCalledTimes(2) // alert + audit log
  })
})

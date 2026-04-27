import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Firestore } from 'firebase-admin/firestore'

const mockStreamAuditEvent = vi.hoisted(() => vi.fn())
const mockSendMassAlertFcm = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ successCount: 0, failureCount: 0, batchCount: 0 }),
)

vi.mock('../../services/audit-stream.js', () => ({
  streamAuditEvent: mockStreamAuditEvent,
}))
vi.mock('../../services/fcm-mass-send.js', () => ({
  sendMassAlertFcm: mockSendMassAlertFcm,
}))
vi.mock('firebase-functions/v2/https', () => ({
  onCall: vi.fn((_opts: unknown, fn: unknown) => fn),
  HttpsError: class HttpsError extends Error {
    code: string
    constructor(code: string, message: string) {
      super(message)
      this.code = code
    }
  },
}))

import { declareEmergencyCore } from '../../callables/declare-emergency.js'
import { ZodError } from 'zod'

function createMockDb() {
  const setFn = vi.fn().mockResolvedValue(undefined)
  const docFn = vi.fn(() => ({ set: setFn }))
  const collectionFn = vi.fn(() => ({ doc: docFn }))
  return {
    collection: collectionFn,
    _setFn: setFn,
    _collectionFn: collectionFn,
  } as unknown as Firestore & {
    _setFn: typeof setFn
    _collectionFn: typeof collectionFn
  }
}

const validInput = {
  hazardType: 'typhoon',
  affectedMunicipalityIds: ['daet', 'san-vicente'],
  message: 'Signal no. 3 raised',
}

describe('declareEmergencyCore', () => {
  let mockDb: ReturnType<typeof createMockDb>

  beforeEach(() => {
    mockDb = createMockDb()
    mockSendMassAlertFcm.mockClear()
    mockStreamAuditEvent.mockClear()
  })

  it('writes alert doc with correct fields', async () => {
    const result = await declareEmergencyCore(mockDb, validInput, { uid: 'admin-1' })

    expect(result.alertId).toBeDefined()
    expect(typeof result.alertId).toBe('string')
    expect(mockDb._collectionFn).toHaveBeenCalledWith('alerts')
    expect(mockDb._setFn).toHaveBeenCalledTimes(1)

    const calls = mockDb._setFn.mock.calls
    expect(calls.length).toBeGreaterThan(0)
    const setArg = (calls[0] as [Record<string, unknown>])[0]
    expect(setArg.alertType).toBe('emergency')
    expect(setArg.hazardType).toBe('typhoon')
    expect(setArg.affectedMunicipalityIds).toEqual(['daet', 'san-vicente'])
    expect(setArg.message).toBe('Signal no. 3 raised')
    expect(setArg.declaredBy).toBe('admin-1')
    expect(setArg.declaredAt).toBeDefined()
    expect(setArg.schemaVersion).toBe(1)
  })

  it('throws ZodError for empty hazardType', async () => {
    await expect(
      declareEmergencyCore(mockDb, { ...validInput, hazardType: '' }, { uid: 'admin-1' }),
    ).rejects.toThrow(ZodError)
  })

  it('throws ZodError for empty municipalityIds', async () => {
    await expect(
      declareEmergencyCore(
        mockDb,
        { ...validInput, affectedMunicipalityIds: [] },
        { uid: 'admin-1' },
      ),
    ).rejects.toThrow(ZodError)
  })

  it('calls sendMassAlertFcm with correct params', async () => {
    await declareEmergencyCore(mockDb, validInput, { uid: 'admin-1' })

    expect(mockSendMassAlertFcm).toHaveBeenCalledWith(mockDb, {
      municipalityIds: ['daet', 'san-vicente'],
      title: 'Emergency: typhoon',
      body: 'Signal no. 3 raised',
    })
  })

  it('streams audit event', async () => {
    const before = Date.now()
    const result = await declareEmergencyCore(mockDb, validInput, { uid: 'admin-1' })
    const after = Date.now()

    expect(mockStreamAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'emergency_declared',
        actorUid: 'admin-1',
        targetDocumentId: result.alertId,
        metadata: { hazardType: 'typhoon' },
      }),
    )
    const calls = mockStreamAuditEvent.mock.calls
    expect(calls.length).toBeGreaterThan(0)
    const callArg = (calls[0] as [{ occurredAt: number }])[0]
    expect(callArg.occurredAt).toBeGreaterThanOrEqual(before)
    expect(callArg.occurredAt).toBeLessThanOrEqual(after)
  })
})

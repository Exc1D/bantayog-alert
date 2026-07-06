import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockHttpsCallable = vi.hoisted(() =>
  vi.fn().mockImplementation(
    () => (payload: unknown) =>
      Promise.resolve({
        data: {
          dispatchId: (payload as Record<string, string>).dispatchId ?? 'mock-dispatch-id',
          status: 'escalated',
          reportId: 'mock-report-id',
          fcmResult: 'sent',
        },
      }),
  ),
)

vi.mock('firebase/functions', async () => {
  const actual = await vi.importActual('firebase/functions')
  return {
    ...actual,
    httpsCallable: mockHttpsCallable,
  }
})

vi.mock('../app/firebase', () => ({
  functions: {},
}))

import { callables } from './callables'

describe('callables.escalateDispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls httpsCallable with the correct payload and returns response data', async () => {
    const payload = {
      dispatchId: 'd-123',
      newResponderUid: 'responder-456',
      idempotencyKey: 'idem-789',
      forceOverride: true,
    }

    const result = await callables.escalateDispatch(payload)

    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'escalateDispatch')
    expect(result).toEqual({
      dispatchId: 'd-123',
      status: 'escalated',
      reportId: 'mock-report-id',
      fcmResult: 'sent',
    })
  })
})

describe('retired admin callable wrappers', () => {
  const retiredCallableNames = [
    // Backend-only operations; see docs/runbooks/pilot-demo.md#backend-only-operations.
    'setRetentionExempt',
    'setErasureLegalHold',
    'approveErasureRequest',
    'suspendUser',
    'revokeUser',
    'resetUserTotp',
    'createUser',
    // Retired features.
    'addCommandChannelMessage',
    'enterFieldMode',
    'exitFieldMode',
    'initiateShiftHandoff',
    'acceptShiftHandoff',
    'declareDataIncident',
    'recordIncidentResponseEvent',
    'upsertProvincialResource',
    'archiveProvincialResource',
    'listScopedOperationsMap',
    'shareReport',
    'requestAgencyAssistance',
    'acceptAgencyAssistance',
    'declineAgencyAssistance',
    'toggleMutualAidVisibility',
  ] as const

  it.each(retiredCallableNames)('does not expose %s', (name) => {
    expect(callables).not.toHaveProperty(name)
  })
})

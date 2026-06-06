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

describe('callables backend/frontend coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const coveredBackendOnlyCallables = {
    mergeDuplicates: {
      primaryReportId: 'report-1',
      duplicateReportIds: ['report-2'],
      idempotencyKey: 'a1b2c3d4-0000-4000-8000-000000000002',
    },
    setCitizenContentVisibility: {
      surface: 'feed',
      contentId: 'sit-1',
      visibility: 'internal',
      reason: 'sensitive_content',
      idempotencyKey: 'a1b2c3d4-0000-4000-8000-000000000004',
    },
    setErasureLegalHold: {
      erasureRequestId: 'erase-1',
      hold: true,
      reason: 'Pending counsel review',
    },
    shareReport: {
      reportId: 'report-1',
      targetMunicipalityId: 'labo',
      reason: 'Border incident',
      idempotencyKey: 'a1b2c3d4-0000-4000-8000-000000000003',
    },
  } as const

  it.each(Object.entries(coveredBackendOnlyCallables))(
    'exposes %s through the admin frontend callable surface',
    async (name, payload) => {
      const callable = callables[name as keyof typeof callables] as (
        ...args: unknown[]
      ) => Promise<unknown>

      await callable(payload)

      expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), name)
    },
  )
})

describe('retired admin callable wrappers', () => {
  const retiredCallableNames = [
    'addCommandChannelMessage',
    'enterFieldMode',
    'exitFieldMode',
    'initiateShiftHandoff',
    'acceptShiftHandoff',
    'declareDataIncident',
    'recordIncidentResponseEvent',
    'upsertProvincialResource',
    'archiveProvincialResource',
  ] as const

  it.each(retiredCallableNames)('does not expose %s', (name) => {
    expect(callables).not.toHaveProperty(name)
  })
})

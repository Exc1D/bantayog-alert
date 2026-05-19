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

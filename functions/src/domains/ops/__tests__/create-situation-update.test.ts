import { describe, expect, it, vi } from 'vitest'
import type { Firestore } from 'firebase-admin/firestore'

// fallow-ignore-next-line code-duplication
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

import { createSituationUpdateCore, inputSchema } from '../create-situation-update.js'

function createMockDb() {
  const add = vi.fn().mockResolvedValue({ id: 'new-update' })
  const collection = vi.fn(() => ({ add }))
  return { collection, _add: add } as unknown as Firestore & { _add: typeof add }
}

const validInput = {
  municipalityId: 'daet',
  municipalityLabel: 'Daet',
  barangayLabel: 'San Jose',
  hazardType: 'typhoon',
  condition: 'heavy_rain',
  body: 'Strong rain near the market.',
}

describe('createSituationUpdateCore', () => {
  it('writes the canonical public update doc for the caller', async () => {
    const db = createMockDb()

    const result = await createSituationUpdateCore(db, {
      uid: 'citizen-1',
      input: inputSchema.parse(validInput),
      now: 1234,
    })

    expect(result).toEqual({ updateId: 'new-update' })
    expect(db.collection).toHaveBeenCalledWith('situation_updates')
    expect(db._add).toHaveBeenCalledWith({
      authorUid: 'citizen-1',
      createdAt: 1234,
      municipalityId: 'daet',
      municipalityLabel: 'Daet',
      barangayLabel: 'San Jose',
      hazardType: 'typhoon',
      condition: 'heavy_rain',
      body: 'Strong rain near the market.',
      visibility: 'public',
      reportedCount: 0,
    })
  })

  it('omits blank optional barangay labels from the stored doc', async () => {
    const db = createMockDb()

    await createSituationUpdateCore(db, {
      uid: 'citizen-1',
      input: inputSchema.parse({ ...validInput, barangayLabel: '   ' }),
      now: 1234,
    })

    const payload = db._add.mock.calls[0]?.[0] as Record<string, unknown>
    expect(payload).not.toHaveProperty('barangayLabel')
  })
})

describe('inputSchema', () => {
  it('trims the body and rejects out-of-range lengths', () => {
    expect(inputSchema.parse({ ...validInput, body: '  ok body  ' }).body).toBe('ok body')
    expect(() => inputSchema.parse({ ...validInput, body: 'x'.repeat(501) })).toThrow()
    expect(() => inputSchema.parse({ ...validInput, body: 'ab' })).toThrow()
  })

  it('rejects unknown hazard types, conditions, and extra keys', () => {
    expect(() => inputSchema.parse({ ...validInput, hazardType: 'meteor' })).toThrow()
    expect(() => inputSchema.parse({ ...validInput, condition: 'lava' })).toThrow()
    expect(() => inputSchema.parse({ ...validInput, visibility: 'public' })).toThrow()
  })
})

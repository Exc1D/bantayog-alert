import { describe, it, expect } from 'vitest'
import { pickProvider, NoProviderAvailableError } from '../../services/sms-health.js'

function mockDb(healthDocs: Record<string, { circuitState: 'closed' | 'open' | 'half_open' }>) {
  return {
    collection: () => ({
      doc: (id: string) => ({
        get: () =>
          Promise.resolve({
            exists: healthDocs[id] !== undefined,
            data: () => healthDocs[id],
          }),
      }),
    }),
  }
}

describe('pickProvider', () => {
  it('returns semaphore when both closed (primary preferred)', async () => {
    const db = mockDb({
      semaphore: { circuitState: 'closed' },
      globelabs: { circuitState: 'closed' },
    })
    await expect(pickProvider(db as never)).resolves.toBe('semaphore')
  })

  it('returns globelabs when semaphore open, globelabs closed', async () => {
    const db = mockDb({
      semaphore: { circuitState: 'open' },
      globelabs: { circuitState: 'closed' },
    })
    await expect(pickProvider(db as never)).resolves.toBe('globelabs')
  })

  it('returns semaphore when primary half_open, secondary open', async () => {
    const db = mockDb({
      semaphore: { circuitState: 'half_open' },
      globelabs: { circuitState: 'open' },
    })
    await expect(pickProvider(db as never)).resolves.toBe('semaphore')
  })

  it('throws NoProviderAvailableError when both open', async () => {
    const db = mockDb({ semaphore: { circuitState: 'open' }, globelabs: { circuitState: 'open' } })
    await expect(pickProvider(db as never)).rejects.toThrow(NoProviderAvailableError)
  })

  it('treats missing health doc as closed (optimistic first-boot)', async () => {
    const db = mockDb({})
    await expect(pickProvider(db as never)).resolves.toBe('semaphore')
  })
})

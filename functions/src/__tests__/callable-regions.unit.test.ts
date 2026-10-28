import { describe, it, expect, vi } from 'vitest'

// The citizen client calls every function in asia-southeast1; a callable
// without an explicit region deploys to us-central1 and 404s from the app.
const { configs } = vi.hoisted(() => ({ configs: [] as unknown[] }))

vi.mock('firebase-functions/v2/https', async () => {
  const actual = await vi.importActual<object>('firebase-functions/v2/https')
  return {
    ...actual,
    onCall: (config: unknown, handler: unknown) => {
      configs.push(config)
      return handler
    },
  }
})
vi.mock('../admin-init.js', () => ({ adminDb: {}, adminAuth: {} }))

describe('citizen callable regions', () => {
  it('pins requestUploadUrl, requestLookup, registerCitizen and deleteOwnAnonymousAccount to asia-southeast1', async () => {
    await import('../domains/media/callables.js')
    await import('../domains/reports/request-lookup.js')
    await import('../domains/users/callables.js')
    await import('../domains/users/delete-own-anonymous-account.js')

    expect(configs.length).toBeGreaterThanOrEqual(4)
    for (const config of configs) {
      expect(config).toMatchObject({ region: 'asia-southeast1' })
    }
  })
})

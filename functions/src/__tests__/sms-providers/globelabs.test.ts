import { describe, it, expect, afterEach, vi } from 'vitest'
import { createGlobelabsSmsProvider } from '../../services/sms-providers/globelabs.js'

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  vi.restoreAllMocks()
  Object.assign(process.env, ORIGINAL_ENV)
})

function mockFetch(data: unknown, ok = true, status = 200) {
  const res = {
    ok,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
  }
  return vi.spyOn(global, 'fetch').mockResolvedValue(res as unknown as Response)
}

function mockFirestore() {
  const store: Record<string, unknown> = {}
  return {
    collection: () => ({
      doc: () => ({
        get: vi.fn().mockResolvedValue({
          exists: store['sms_provider_tokens/globelabs'] !== undefined,
          data: () => store['sms_provider_tokens/globelabs'],
        }),
        set: vi.fn().mockImplementation((data: unknown) => {
          store['sms_provider_tokens/globelabs'] = data
          return Promise.resolve()
        }),
      }),
    }),
    _store: store,
  }
}

describe('createGlobelabsSmsProvider', () => {
  it('sends SMS successfully with cached token', async () => {
    const mockDb = mockFirestore()
    mockDb._store['sms_provider_tokens/globelabs'] = {
      accessToken: 'valid-token',
      expiresAt: Date.now() + 300_000,
      refreshedAt: Date.now(),
    }

    mockFetch({ outboundSMSMessageRequest: { resourceURL: 'https://example.com/msg/123' } })

    const provider = createGlobelabsSmsProvider({ getFirestore: () => mockDb as never })
    const r = await provider.send({
      to: '+639171234567',
      body: 'Hello Globe',
      encoding: 'GSM-7',
      idempotencyKey: 'idem-123',
    })
    expect(r.accepted).toBe(true)
    if (r.accepted) {
      expect(r.providerMessageId).toContain('123')
    }
  })

  it('refreshes token on 401 and retries', async () => {
    process.env.GLOBE_LABS_APP_ID = 'test-app-id'
    process.env.GLOBE_LABS_APP_SECRET = 'test-app-secret'
    const mockDb = mockFirestore()
    mockDb._store['sms_provider_tokens/globelabs'] = {
      accessToken: 'expired-token',
      expiresAt: Date.now() - 60_000,
      refreshedAt: Date.now(),
    }

    let callCount = 0
    vi.spyOn(global, 'fetch').mockImplementation((url: unknown) => {
      const urlStr = String(url)
      if (urlStr.includes('oauth/token')) {
        mockDb._store['sms_provider_tokens/globelabs'] = {
          accessToken: 'new-refreshed-token',
          expiresAt: Date.now() + 300_000,
          refreshedAt: Date.now(),
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ access_token: 'new-refreshed-token', expires_in: 3600 }),
        } as unknown as Response)
      }
      callCount++
      if (callCount === 1) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({}),
        } as unknown as Response)
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ outboundSMSMessageRequest: { resourceURL: 'msg/456' } }),
      } as unknown as Response)
    })

    const provider = createGlobelabsSmsProvider({ getFirestore: () => mockDb as never })
    const r = await provider.send({ to: '+639171234567', body: 'Retry test', encoding: 'GSM-7' })
    expect(r.accepted).toBe(true)
  })

  it('throws SmsProviderRetryableError on 429 rate limit', async () => {
    const mockDb = mockFirestore()
    mockDb._store['sms_provider_tokens/globelabs'] = {
      accessToken: 'valid-token',
      expiresAt: Date.now() + 300_000,
      refreshedAt: Date.now(),
    }

    mockFetch({}, false, 429)

    const provider = createGlobelabsSmsProvider({ getFirestore: () => mockDb as never })
    await expect(
      provider.send({ to: '+639171234567', body: 'Hello', encoding: 'GSM-7' }),
    ).rejects.toThrow('globelabs 429')
  })

  it('throws SmsProviderRetryableError on 500 server error', async () => {
    const mockDb = mockFirestore()
    mockDb._store['sms_provider_tokens/globelabs'] = {
      accessToken: 'valid-token',
      expiresAt: Date.now() + 300_000,
      refreshedAt: Date.now(),
    }

    mockFetch({}, false, 500)

    const provider = createGlobelabsSmsProvider({ getFirestore: () => mockDb as never })
    await expect(
      provider.send({ to: '+639171234567', body: 'Hello', encoding: 'GSM-7' }),
    ).rejects.toThrow('globelabs 500')
  })

  describe('token mutex — concurrent requests', () => {
    it('only refreshes token once when multiple callers need it', async () => {
      process.env.GLOBE_LABS_APP_ID = 'test-app-id'
      process.env.GLOBE_LABS_APP_SECRET = 'test-app-secret'

      let oauthCallCount = 0
      const mockDb = mockFirestore()

      vi.spyOn(global, 'fetch').mockImplementation((url: unknown) => {
        const urlStr = String(url)
        if (urlStr.includes('oauth/token')) {
          oauthCallCount++
          mockDb._store['sms_provider_tokens/globelabs'] = {
            accessToken: 'shared-token',
            expiresAt: Date.now() + 300_000,
            refreshedAt: Date.now(),
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ access_token: 'shared-token', expires_in: 3600 }),
          } as unknown as Response)
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({ outboundSMSMessageRequest: { resourceURL: 'msg/mutex-test' } }),
        } as unknown as Response)
      })

      const provider = createGlobelabsSmsProvider({ getFirestore: () => mockDb as never })

      const [r1, r2, r3] = await Promise.all([
        provider.send({ to: '+639171234567', body: 'msg1', encoding: 'GSM-7' }),
        provider.send({ to: '+639171234567', body: 'msg2', encoding: 'GSM-7' }),
        provider.send({ to: '+639171234567', body: 'msg3', encoding: 'GSM-7' }),
      ])

      expect(r1.accepted).toBe(true)
      expect(r2.accepted).toBe(true)
      expect(r3.accepted).toBe(true)
      expect(oauthCallCount).toBe(1)
    })
  })
})

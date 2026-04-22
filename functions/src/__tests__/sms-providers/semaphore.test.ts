import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createSemaphoreSmsProvider } from '../../services/sms-providers/semaphore.js'

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  process.env.SEMAPHORE_API_KEY = 'test-api-key'
  process.env.SMS_SENDER_NAME = 'BANTAYOG'
})

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

describe('createSemaphoreSmsProvider', () => {
  it('sends to /messages/send for normal priority', async () => {
    mockFetch({ message_id: 12345, status: 'Queued', network: 'Globe' })
    const provider = createSemaphoreSmsProvider()
    const r = await provider.send({ to: '+639171234567', body: 'Hello', encoding: 'GSM-7' })
    expect(r.accepted).toBe(true)
    if (r.accepted) {
      expect(r.providerMessageId).toBe('12345')
      expect(r.encoding).toBe('GSM-7')
    }
    const calls = vi.mocked(global.fetch).mock.calls as unknown as string[][]
    expect(calls[0]?.[0] ?? '').toContain('api.semaphore.co/messages/send')
  })

  it('sends to /otp/send for urgent priority', async () => {
    mockFetch({ message_id: 67890, status: 'Queued' })
    const provider = createSemaphoreSmsProvider()
    await provider.send({ to: '+639171234567', body: 'OTP', encoding: 'GSM-7', priority: 'urgent' })
    const calls = vi.mocked(global.fetch).mock.calls as unknown as string[][]
    expect(calls[0]?.[0] ?? '').toContain('api.semaphore.co/otp/send')
  })

  it('maps zero-credit body error to provider_limit', async () => {
    mockFetch({ status: 'Error', message: 'Insufficient credit', message_id: 0 })
    const provider = createSemaphoreSmsProvider()
    const r = await provider.send({ to: '+639171234567', body: 'Hello', encoding: 'GSM-7' })
    expect(r.accepted).toBe(false)
    expect((r as { reason?: string }).reason).toBe('provider_limit')
  })

  it('maps 400 sender error to bad_format', async () => {
    mockFetch({ errors: [{ error: 'Sender name not approved' }] }, false, 400)
    const provider = createSemaphoreSmsProvider()
    const r = await provider.send({ to: '+639171234567', body: 'Hello', encoding: 'GSM-7' })
    expect(r.accepted).toBe(false)
    expect((r as { reason?: string }).reason).toBe('bad_format')
  })

  it('throws SmsProviderRetryableError on 429 rate limit', async () => {
    mockFetch({ errors: [] }, false, 429)
    const provider = createSemaphoreSmsProvider()
    await expect(
      provider.send({ to: '+639171234567', body: 'Hello', encoding: 'GSM-7' }),
    ).rejects.toThrow('semaphore 429')
  })

  it('throws SmsProviderRetryableError on 500 server error', async () => {
    mockFetch({ errors: [{ error: 'Internal error' }] }, false, 500)
    const provider = createSemaphoreSmsProvider()
    await expect(
      provider.send({ to: '+639171234567', body: 'Hello', encoding: 'GSM-7' }),
    ).rejects.toThrow('semaphore 500')
  })

  it('throws on missing SEMAPHORE_API_KEY', async () => {
    delete process.env.SEMAPHORE_API_KEY
    const provider = createSemaphoreSmsProvider()
    await expect(
      provider.send({ to: '+639171234567', body: 'Hello', encoding: 'GSM-7' }),
    ).rejects.toThrow('SEMAPHORE_API_KEY')
  })

  it('normalizes MSISDN before sending', async () => {
    mockFetch({ message_id: 1, status: 'Queued' })
    const provider = createSemaphoreSmsProvider()
    await provider.send({ to: '09171234567', body: 'Test', encoding: 'GSM-7' })
    const calls = vi.mocked(global.fetch).mock.calls as unknown as string[][]
    const url = calls[0]?.[0] ?? ''
    expect(url).toContain('number=639171234567')
  })

  it('uses bodyPreviewHash as message body (not real body)', async () => {
    mockFetch({ message_id: 1, status: 'Queued' })
    const provider = createSemaphoreSmsProvider()
    await provider.send({ to: '+639171234567', body: 'b'.repeat(64), encoding: 'GSM-7' })
    const calls = vi.mocked(global.fetch).mock.calls as unknown as string[][]
    const url = calls[0]?.[0] ?? ''
    expect(url).toContain('message=' + encodeURIComponent('b'.repeat(64)))
  })
})

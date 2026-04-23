import type { SmsProvider } from '../sms-provider.js'
import {
  SmsProviderRetryableError,
  type SmsProviderSendInput,
  type SmsProviderSendResult,
  type SmsProviderSendRejected,
} from '../sms-provider.js'
import { normalizeMsisdn } from '@bantayog/shared-validators'

interface SemaphoreResponse {
  status?: string
  message_id?: number | string
  errors?: { error: string }[]
  message?: string
}

const PROVIDER_TIMEOUT_MS = 5_000

export function createSemaphoreSmsProvider(): SmsProvider {
  return {
    providerId: 'semaphore',
    async send(input: SmsProviderSendInput): Promise<SmsProviderSendResult> {
      const apiKey = process.env.SEMAPHORE_API_KEY
      if (!apiKey) throw new Error('SEMAPHORE_API_KEY not set')

      const normalizedTo = normalizeMsisdn(input.to).replace(/^\+/, '')

      const endpoint =
        input.priority === 'urgent'
          ? 'https://api.semaphore.co/otp/send'
          : 'https://api.semaphore.co/messages/send'

      const params = new URLSearchParams({
        apiKey,
        number: normalizedTo,
        message: input.body,
        sendername: process.env.SMS_SENDER_NAME ?? 'SEMAPHORE',
      })

      const controller = new AbortController()
      const timer = setTimeout(() => {
        controller.abort()
      }, PROVIDER_TIMEOUT_MS)
      let res: Response
      try {
        res = await fetch(`${endpoint}?${params.toString()}`, {
          method: 'POST',
          signal: controller.signal,
        })
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          throw new SmsProviderRetryableError('semaphore request timed out', 'provider_error')
        }
        throw err
      } finally {
        clearTimeout(timer)
      }

      let data: SemaphoreResponse = {}
      try {
        data = (await res.json()) as SemaphoreResponse
      } catch (err: unknown) {
        // 4xx errors are non-retryable (client request issues)
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          return { accepted: false, reason: 'other' as const, latencyMs: 0 }
        }
        // 5xx and network errors are retryable
        throw new SmsProviderRetryableError(
          `semaphore ${res.status.toString()}: unparseable response (${String(err)})`,
          res.status === 429 ? 'rate_limited' : 'provider_error',
        )
      }

      const status = data.status ?? ''
      const errorsArr = data.errors ?? []
      const messageId = String(data.message_id ?? '')
      const firstErr = errorsArr[0]

      // Check HTTP error codes first — these take precedence
      if (!res.ok) {
        const retryable = res.status >= 500 || res.status === 429
        if (retryable) {
          throw new SmsProviderRetryableError(
            `semaphore ${res.status.toString()}: ${firstErr?.error ?? res.statusText}`,
            res.status === 429 ? 'rate_limited' : 'provider_error',
          )
        }
        // 400 bad format — e.g. unapproved sender name
        if (res.status === 400 && /sender/i.test(firstErr?.error ?? '')) {
          return { accepted: false, reason: 'bad_format' as const, latencyMs: 0 }
        }
        return { accepted: false, reason: 'other' as const, latencyMs: 0 }
      }

      // Semaphore returns 200 even on credit failure — check body status
      if (status === 'Error') {
        const msg = firstErr?.error ?? data.message ?? 'unknown'
        // Credit exhaustion = non-retryable (account-level problem)
        const nonRetryable = /credit|insufficient|balance/i.test(msg)
        const rejected: SmsProviderSendRejected = {
          accepted: false,
          latencyMs: 0,
          reason: nonRetryable ? 'provider_limit' : 'other',
        }
        if (messageId) rejected.providerMessageId = messageId
        return rejected
      }

      if (status === 'Queued') {
        const success = {
          accepted: true as const,
          providerMessageId: messageId,
          latencyMs: 0,
          segmentCount: input.segmentCount ?? 1,
          encoding: input.encoding,
        }
        return success
      }
      // Fallback: unexpected status
      return { accepted: false, reason: 'other' as const, latencyMs: 0 }
    },
  }
}

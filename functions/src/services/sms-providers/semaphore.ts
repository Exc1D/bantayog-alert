import type { SmsProvider } from '../sms-provider.js'
import { SmsProviderNotImplementedError } from '../sms-provider.js'

export function createSemaphoreSmsProvider(): SmsProvider {
  return {
    providerId: 'semaphore',
    send() {
      return Promise.reject(new SmsProviderNotImplementedError('semaphore'))
    },
  }
}

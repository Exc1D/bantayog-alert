import type { SmsProvider } from '../sms-provider.js'
import { SmsProviderNotImplementedError } from '../sms-provider.js'

export function createGlobelabsSmsProvider(): SmsProvider {
  return {
    providerId: 'globelabs',
    send() {
      return Promise.reject(new SmsProviderNotImplementedError('globelabs'))
    },
  }
}

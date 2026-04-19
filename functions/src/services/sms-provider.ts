import type { SmsEncoding } from '@bantayog/shared-validators'

export interface SmsProviderSendSuccess {
  accepted: true
  providerMessageId: string
  latencyMs: number
  segmentCount: number
  encoding: SmsEncoding
}

export interface SmsProviderSendRejected {
  accepted: false
  providerMessageId?: string
  latencyMs: number
  reason: 'invalid_number' | 'ban' | 'bad_format' | 'other'
  segmentCount?: number
  encoding?: SmsEncoding
}

export type SmsProviderSendResult = SmsProviderSendSuccess | SmsProviderSendRejected

export type SmsProviderRuntimeId = 'semaphore' | 'globelabs' | 'fake'

export interface SmsProviderSendInput {
  to: string
  body: string
  encoding: SmsEncoding
}

export interface SmsProvider {
  readonly providerId: SmsProviderRuntimeId
  send(input: SmsProviderSendInput): Promise<SmsProviderSendResult>
}

export class SmsProviderRetryableError extends Error {
  constructor(
    message: string,
    public readonly kind: 'rate_limited' | 'provider_error' | 'network',
  ) {
    super(message)
    this.name = 'SmsProviderRetryableError'
  }
}

export class SmsProviderNotImplementedError extends Error {
  constructor(providerId: SmsProviderRuntimeId) {
    super(`${providerId} provider is not implemented in Phase 4a`)
    this.name = 'SmsProviderNotImplementedError'
  }
}

import type { FirestoreTimestamp } from './auth'

/** sms_outbox/{msgId} */
export interface SmsOutbox {
  to: string
  body: string
  purpose: 'status_update' | 'advisory' | 'dispatch_notification' | 'auto_reply' | 'mass_alert'
  priority: 'normal' | 'priority'
  providerId: 'semaphore' | 'globelabs'
  status: 'queued' | 'sent' | 'delivered' | 'failed'
  correlationId: string
  createdAt: FirestoreTimestamp
  sentAt?: FirestoreTimestamp
  deliveredAt?: FirestoreTimestamp
  failedAt?: FirestoreTimestamp
  failureReason?: string
}

/** sms_inbox/{msgId} */
export interface SmsInbox {
  msisdn: string
  body: string
  receivedAt: FirestoreTimestamp
  parsedSuccessfully: boolean
  parseResult?: {
    type: string
    barangay: string
    municipalityId?: string
  }
  inboxItemId?: string
}

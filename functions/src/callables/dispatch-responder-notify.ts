import type { Firestore, Transaction } from 'firebase-admin/firestore'
import { enqueueSms } from '../services/send-sms.js'

interface EnqueueDispatchSmsArgs {
  db: Firestore
  tx: Transaction
  reportId: string
  dispatchId: string
  recipientMsisdn: string
  locale: 'tl' | 'en'
  publicRef: string
  salt: string
  nowMs: number
}

export function enqueueDispatchSms(args: EnqueueDispatchSmsArgs): void {
  const { db, tx, reportId, dispatchId, recipientMsisdn, locale, publicRef, salt, nowMs } = args
  enqueueSms(db, tx, {
    reportId,
    dispatchId,
    purpose: 'status_update',
    recipientMsisdn,
    locale,
    publicRef,
    salt,
    nowMs,
    providerId: 'semaphore',
  })
}

import { useEffect, useRef, useState } from 'react'
import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore'
import { db } from '@/app/firebase'
import {
  smsOutboxDocSchema,
  smsInboxDocSchema,
  smsProviderHealthDocSchema,
  type SmsOutboxDoc,
  type SmsInboxDoc,
  type SmsProviderHealthDoc,
} from '@bantayog/shared-validators'

export interface SmsOutboxWithId extends SmsOutboxDoc {
  id: string
}

export interface SmsInboxWithId extends SmsInboxDoc {
  id: string
}

export interface SmsProviderHealthWithId extends SmsProviderHealthDoc {
  id: string
}

export interface SmsAuditResult {
  outbox: SmsOutboxWithId[]
  inbox: SmsInboxWithId[]
  providerHealth: SmsProviderHealthWithId[]
  loading: boolean
  error: string | null
}

interface RespondedRef {
  outbox: boolean
  inbox: boolean
  health: boolean
}

export function useSmsAudit(): SmsAuditResult {
  const [outbox, setOutbox] = useState<SmsOutboxWithId[]>([])
  const [inbox, setInbox] = useState<SmsInboxWithId[]>([])
  const [providerHealth, setProviderHealth] = useState<SmsProviderHealthWithId[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const respondedRef = useRef<RespondedRef>({ outbox: false, inbox: false, health: false })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(null)
    setOutbox([])
    setInbox([])
    setProviderHealth([])
    respondedRef.current = { outbox: false, inbox: false, health: false }

    const markResponded = (key: keyof RespondedRef) => {
      if (!respondedRef.current[key]) {
        respondedRef.current[key] = true
        if (
          respondedRef.current.outbox &&
          respondedRef.current.inbox &&
          respondedRef.current.health
        ) {
          setLoading(false)
        }
      }
    }

    // SMS collections are global (no municipalityId field on SMS docs),
    // so this hook does not scope by municipality.
    const outboxQuery = query(
      collection(db, 'sms_outbox'),
      orderBy('createdAt', 'desc'),
      limit(100),
    )
    const inboxQuery = query(collection(db, 'sms_inbox'), orderBy('receivedAt', 'desc'), limit(100))
    const healthQuery = query(collection(db, 'sms_provider_health'))

    const unsubOutbox = onSnapshot(
      outboxQuery,
      (snap) => {
        const parsed = snap.docs
          .map((doc) => {
            const result = smsOutboxDocSchema.safeParse(doc.data())
            if (!result.success) {
              console.warn(`Invalid sms_outbox doc ${doc.id}:`, result.error)
              return null
            }
            return { id: doc.id, ...result.data }
          })
          .filter((e): e is SmsOutboxWithId => e !== null)
        setOutbox(parsed)
        markResponded('outbox')
      },
      (err) => {
        console.error('Error fetching sms_outbox:', err)
        setError((prev) =>
          prev
            ? `${prev}; ${err instanceof Error ? err.message : 'Failed to fetch SMS outbox'}`
            : err instanceof Error
              ? err.message
              : 'Failed to fetch SMS outbox',
        )
        markResponded('outbox')
      },
    )

    const unsubInbox = onSnapshot(
      inboxQuery,
      (snap) => {
        const parsed = snap.docs
          .map((doc) => {
            const result = smsInboxDocSchema.safeParse(doc.data())
            if (!result.success) {
              console.warn(`Invalid sms_inbox doc ${doc.id}:`, result.error)
              return null
            }
            return { id: doc.id, ...result.data }
          })
          .filter((e): e is SmsInboxWithId => e !== null)
        setInbox(parsed)
        markResponded('inbox')
      },
      (err) => {
        console.error('Error fetching sms_inbox:', err)
        setError((prev) =>
          prev
            ? `${prev}; ${err instanceof Error ? err.message : 'Failed to fetch SMS inbox'}`
            : err instanceof Error
              ? err.message
              : 'Failed to fetch SMS inbox',
        )
        markResponded('inbox')
      },
    )

    const unsubHealth = onSnapshot(
      healthQuery,
      (snap) => {
        const parsed = snap.docs
          .map((doc) => {
            const result = smsProviderHealthDocSchema.safeParse(doc.data())
            if (!result.success) {
              console.warn(`Invalid sms_provider_health doc ${doc.id}:`, result.error)
              return null
            }
            return { id: doc.id, ...result.data }
          })
          .filter((e): e is SmsProviderHealthWithId => e !== null)
        setProviderHealth(parsed)
        markResponded('health')
      },
      (err) => {
        console.error('Error fetching sms_provider_health:', err)
        setError((prev) =>
          prev
            ? `${prev}; ${err instanceof Error ? err.message : 'Failed to fetch provider health'}`
            : err instanceof Error
              ? err.message
              : 'Failed to fetch provider health',
        )
        markResponded('health')
      },
    )

    return () => {
      unsubOutbox()
      unsubInbox()
      unsubHealth()
    }
  }, [])

  return { outbox, inbox, providerHealth, loading, error }
}

import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../app/firebase'
import {
  agencyAssistanceRequestDocSchema,
  logDimension,
  type AgencyAssistanceRequestDoc,
} from '@bantayog/shared-validators'

const log = logDimension('useAgencyAssistanceQueue')

export interface BackupRequest {
  id: string
  reportId: string
  municipalityId: string
  reason: string
  status: 'pending' | 'accepted' | 'declined' | 'fulfilled' | 'expired'
  agencyId: string
  createdAt: number
}

const VALID_BACKUP_STATUSES: BackupRequest['status'][] = [
  'pending',
  'accepted',
  'declined',
  'fulfilled',
  'expired',
]

function parseBackupRequest(id: string, raw: Record<string, unknown>): BackupRequest | null {
  if (
    typeof raw.reportId !== 'string' ||
    typeof raw.reason !== 'string' ||
    typeof raw.agencyId !== 'string' ||
    typeof raw.createdAt !== 'number'
  ) {
    log({
      severity: 'WARNING',
      code: 'backup_request.invalid',
      message: `Invalid backup_request ${id}`,
      data: {},
    })
    return null
  }
  return {
    id,
    reportId: raw.reportId,
    municipalityId: typeof raw.municipalityId === 'string' ? raw.municipalityId : '',
    reason: raw.reason,
    status:
      typeof raw.status === 'string' &&
      VALID_BACKUP_STATUSES.includes(raw.status as BackupRequest['status'])
        ? (raw.status as BackupRequest['status'])
        : 'pending',
    agencyId: raw.agencyId,
    createdAt: raw.createdAt,
  }
}

export function useAgencyAssistanceQueue(agencyId: string | undefined) {
  const [requests, setRequests] = useState<(AgencyAssistanceRequestDoc & { id: string })[]>([])
  const [backupRequests, setBackupRequests] = useState<BackupRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requestsReady, setRequestsReady] = useState(false)
  const [backupReady, setBackupReady] = useState(false)

  useEffect(() => {
    queueMicrotask(() => {
      setError(null)
      setRequests([])
      setBackupRequests([])
      setRequestsReady(false)
      setBackupReady(false)
    })

    if (!agencyId) {
      queueMicrotask(() => {
        setLoading(false)
      })
      return
    }

    queueMicrotask(() => {
      setLoading(true)
    })

    const q = query(
      collection(db, 'agency_assistance_requests'),
      where('targetAgencyId', '==', agencyId),
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const parsed = snapshot.docs.flatMap((doc) => {
          const result = agencyAssistanceRequestDocSchema.safeParse(doc.data())
          if (!result.success) {
            log({
              severity: 'WARNING',
              code: 'agency_assistance.invalid',
              message: `Doc ${doc.id} failed schema`,
              data: {},
            })
            return []
          }
          return [{ ...result.data, id: doc.id }]
        })
        setRequests(parsed)
        setRequestsReady(true)
      },
      (err) => {
        setError(err.message)
        setRequestsReady(true)
      },
    )

    const backupQ = query(collection(db, 'backup_requests'), where('agencyId', '==', agencyId))

    const unsubscribeBackup = onSnapshot(
      backupQ,
      (snapshot) => {
        const parsed = snapshot.docs.flatMap((doc) => {
          const req = parseBackupRequest(doc.id, doc.data() as Record<string, unknown>)
          return req ? [req] : []
        })
        setBackupRequests(parsed)
        setBackupReady(true)
      },
      (err) => {
        setError(err.message)
        setBackupReady(true)
      },
    )

    return () => {
      unsubscribe()
      unsubscribeBackup()
    }
  }, [agencyId])

  useEffect(() => {
    if (requestsReady && backupReady) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false)
    }
  }, [requestsReady, backupReady])

  return { requests, backupRequests, loading, error }
}

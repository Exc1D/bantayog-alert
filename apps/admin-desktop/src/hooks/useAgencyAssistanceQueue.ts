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
    status: typeof raw.status === 'string' ? (raw.status as BackupRequest['status']) : 'pending',
    agencyId: raw.agencyId,
    createdAt: raw.createdAt,
  }
}

export function useAgencyAssistanceQueue(agencyId: string | undefined) {
  const [requests, setRequests] = useState<(AgencyAssistanceRequestDoc & { id: string })[]>([])
  const [backupRequests, setBackupRequests] = useState<BackupRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    queueMicrotask(() => {
      setError(null)
      setRequests([])
      setBackupRequests([])
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
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
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
      },
      () => {
        // Backup request errors are non-fatal
      },
    )

    return () => {
      unsubscribe()
      unsubscribeBackup()
    }
  }, [agencyId])

  return { requests, backupRequests, loading, error }
}

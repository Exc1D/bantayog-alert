import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../app/firebase'

export interface AgencyAssistanceRequest {
  id: string
  reportId: string
  requestedByMunicipality: string
  message: string
  priority: 'urgent' | 'normal'
  status: 'pending' | 'accepted' | 'declined' | 'fulfilled' | 'expired'
  targetAgencyId: string
  createdAt: number
}

export interface BackupRequest {
  id: string
  reportId: string
  municipalityId: string
  reason: string
  status: 'pending' | 'accepted' | 'declined' | 'fulfilled' | 'expired'
  agencyId: string
  createdAt: number
}

export function useAgencyAssistanceQueue(agencyId: string | undefined) {
  const [requests, setRequests] = useState<AgencyAssistanceRequest[]>([])
  const [backupRequests, setBackupRequests] = useState<BackupRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    queueMicrotask(() => {
      setError(null)
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
        const docs: AgencyAssistanceRequest[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as AgencyAssistanceRequest[]
        setRequests(docs)
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
        const docs: BackupRequest[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as BackupRequest[]
        setBackupRequests(docs)
      },
      () => {
        // Backup request errors are non-fatal; don't overwrite main error state
      },
    )

    return () => {
      unsubscribe()
      unsubscribeBackup()
    }
  }, [agencyId])

  return { requests, backupRequests, loading, error }
}

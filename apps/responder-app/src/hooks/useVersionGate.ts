import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import type { MinAppVersionDoc, UpdateUrlsDoc } from '@bantayog/shared-types'
import { semverLt } from '@bantayog/shared-validators'
import { db } from '../app/firebase'

export function useVersionGate() {
  const [blocked, setBlocked] = useState(false)
  const [updateUrl, setUpdateUrl] = useState<string | null>(null)

  useEffect(() => {
    const unsubMin = onSnapshot(doc(db, 'system_config', 'min_app_version'), {
      next: (snap) => {
        if (!snap.exists()) return
        const data = snap.data() as MinAppVersionDoc
        if (typeof data.responder !== 'string') {
          console.error('[VersionGate] Invalid min_app_version document shape')
          setBlocked(true)
          return
        }
        setBlocked(semverLt(__APP_VERSION__, data.responder))
      },
      error: (err) => {
        console.error('[VersionGate] Failed to listen to min_app_version:', err)
        setBlocked(true)
      },
    })

    const unsubUrls = onSnapshot(doc(db, 'system_config', 'update_urls'), {
      next: (snap) => {
        if (!snap.exists()) return
        const data = snap.data() as UpdateUrlsDoc
        setUpdateUrl(data.responder || null)
      },
      error: (err) => {
        console.error('[VersionGate] Failed to listen to update_urls:', err)
      },
    })

    return () => {
      unsubMin()
      unsubUrls()
    }
  }, [])

  return { blocked, updateUrl }
}

import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import type { MinAppVersionDoc, UpdateUrlsDoc } from '@bantayog/shared-types'
import { hasFirebaseConfig, db } from '../services/firebase.js'

declare const __APP_VERSION__: string

export function semverLt(a: string, b: string): boolean {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    if (x < y) return true
    if (x > y) return false
  }
  return false
}

export function useVersionGate() {
  const [blocked, setBlocked] = useState(false)
  const [updateUrl, setUpdateUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!hasFirebaseConfig()) return

    const unsubMin = onSnapshot(doc(db(), 'system_config', 'min_app_version'), (snap) => {
      if (!snap.exists()) return
      const data = snap.data() as MinAppVersionDoc
      setBlocked(semverLt(__APP_VERSION__, data.citizen))
    })

    const unsubUrls = onSnapshot(doc(db(), 'system_config', 'update_urls'), (snap) => {
      if (!snap.exists()) return
      const data = snap.data() as UpdateUrlsDoc
      setUpdateUrl(data.citizen || null)
    })

    return () => {
      unsubMin()
      unsubUrls()
    }
  }, [])

  return { blocked, updateUrl }
}

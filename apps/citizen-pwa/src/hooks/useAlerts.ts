import { useState, useEffect } from 'react'
import { subscribeAlerts } from '@bantayog/shared-firebase'
import { db, hasFirebaseConfig } from '../services/firebase.js'
import type { AlertDoc } from '@bantayog/shared-types'

export function useAlerts(): { alerts: AlertDoc[]; loading: boolean } {
  const firebaseConfigured = hasFirebaseConfig()
  const [alerts, setAlerts] = useState<AlertDoc[]>([])
  const [loading, setLoading] = useState(firebaseConfigured)

  useEffect(() => {
    if (!firebaseConfigured) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false)
      return
    }

    const unsubscribe = subscribeAlerts(db(), (docs) => {
      setAlerts(docs)
      setLoading(false)
    })

    return unsubscribe
  }, [firebaseConfigured])

  return { alerts, loading }
}

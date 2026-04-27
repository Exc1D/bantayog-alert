import { useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../app/firebase'
import { CAMARINES_NORTE_MUNICIPALITIES } from '@bantayog/shared-validators'

export interface MunicipalPerformance {
  municipalityId: string
  avgResponseTimeMinutes: number | null
  resolvedToday: number
}

const MUNICIPALITY_IDS = CAMARINES_NORTE_MUNICIPALITIES.map((m) => m.id)

export function useMunicipalPerformance(): MunicipalPerformance[] {
  const [data, setData] = useState<MunicipalPerformance[]>([])
  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const results = await Promise.all(
        MUNICIPALITY_IDS.map(async (id) => {
          const snap = await getDoc(doc(db, 'analytics_snapshots', today, id, 'summary'))
          const d = snap.data()
          return {
            municipalityId: id,
            avgResponseTimeMinutes:
              typeof d?.avgResponseTimeMinutes === 'number' ? d.avgResponseTimeMinutes : null,
            resolvedToday: typeof d?.resolvedToday === 'number' ? d.resolvedToday : 0,
          }
        }),
      )
      if (!cancelled) setData(results)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [today])

  return data
}

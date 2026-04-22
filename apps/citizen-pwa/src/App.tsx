import { useEffect } from 'react'
import { collection, query, where, getDocs, limit } from 'firebase/firestore'
import { AppRoutes } from './routes.js'
import { draftStore } from './services/draft-store.js'
import { db } from './services/firebase.js'

export function App() {
  useEffect(() => {
    const recover = async () => {
      try {
        const orphans = await draftStore.recoverOrphaned()
        for (const draft of orphans) {
          const exists = await checkInboxExists(draft.clientDraftRef)
          if (!exists) {
            await draftStore.save({ ...draft, syncState: 'syncing', updatedAt: Date.now() })
          } else {
            await draftStore.clear(draft.id).catch((e: unknown) => {
              console.warn('[App] Failed to clear draft after inbox found:', draft.id, e)
            })
          }
        }
      } catch (e: unknown) {
        console.warn('[App] Draft recovery failed:', e)
      }
    }
    void recover()
  }, [])

  return <AppRoutes />
}

async function checkInboxExists(clientDraftRef: string): Promise<boolean> {
  const q = query(
    collection(db(), 'report_inbox'),
    where('clientDraftRef', '==', clientDraftRef),
    limit(1),
  )
  const snap = await getDocs(q)
  return !snap.empty
}

import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, limit } from 'firebase/firestore'
import { AppRoutes } from './routes.js'
import { draftStore } from './services/draft-store.js'
import { db } from './services/firebase.js'

export function App() {
  const [recoveredDraft, setRecoveredDraft] = useState<unknown>(null)

  useEffect(() => {
    const recover = async () => {
      try {
        const orphans = await draftStore.recoverOrphaned()
        for (const draft of orphans) {
          const exists = await checkInboxExists(draft.clientDraftRef)
          if (!exists) {
            await draftStore.save({ ...draft, syncState: 'syncing', updatedAt: Date.now() })
            setRecoveredDraft(draft)
          } else {
            await draftStore.clear(draft.id).catch((_e: unknown) => {
              void _e
            })
          }
        }
      } catch (_e: unknown) {
        void _e
      }
    }
    void recover()
  }, [])

  void recoveredDraft

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

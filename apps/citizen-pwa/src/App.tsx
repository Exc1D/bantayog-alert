import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, limit } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { AppRoutes } from './routes.js'
import { draftStore } from './services/draft-store.js'
import { db, auth, hasFirebaseConfig } from './services/firebase.js'
import { VersionGate } from './components/VersionGate.js'
import { PrivacyNoticeModal } from './components/PrivacyNoticeModal.js'

export function App() {
  const [uid, setUid] = useState<string | null>(null)

  useEffect(() => {
    if (!hasFirebaseConfig()) return
    const unsub = onAuthStateChanged(auth(), (user) => {
      setUid(user?.uid ?? null)
    })
    return unsub
  }, [])

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

  return (
    <VersionGate>
      <PrivacyNoticeModal uid={uid} />
      <AppRoutes />
    </VersionGate>
  )
}

async function checkInboxExists(clientDraftRef: string): Promise<boolean> {
  const q = query(
    collection(db(), 'report_inbox'),
    where('payload.clientDraftRef', '==', clientDraftRef),
    limit(1),
  )
  const snap = await getDocs(q)
  return !snap.empty
}

import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../app/firebase'
import { useCallableAction } from './useCallableAction'

export function useAddFieldNote(reportId: string) {
  const { run, loading, error } = useCallableAction('useAddFieldNote', reportId)

  async function addNote(content: string): Promise<void> {
    if (!reportId.trim()) throw new Error('reportId_required')
    const trimmed = content.trim()
    if (!trimmed) throw new Error('content_required')

    await run(async ({ user }) => {
      await addDoc(collection(db, 'reports', reportId, 'field_notes'), {
        body: trimmed,
        authorUid: user.uid,
        authorRole: 'responder',
        authorDisplayName: user.displayName ?? 'Responder',
        createdAt: serverTimestamp(),
        schemaVersion: 1,
      })
    })
  }

  return { addNote, loading, error }
}

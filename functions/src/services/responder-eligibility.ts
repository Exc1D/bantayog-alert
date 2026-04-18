import type { Firestore } from 'firebase-admin/firestore'
import type { Database } from 'firebase-admin/database'

export interface EligibleResponder {
  uid: string
  displayName: string
  agencyId: string
  municipalityId: string
}

export async function getEligibleResponders(
  db: Firestore,
  rtdb: Database,
  filter: { municipalityId: string; agencyId?: string },
): Promise<EligibleResponder[]> {
  let q = db
    .collection('responders')
    .where('municipalityId', '==', filter.municipalityId)
    .where('isActive', '==', true)
  if (filter.agencyId) {
    q = q.where('agencyId', '==', filter.agencyId)
  }

  const [respondersSnap, shiftSnap] = await Promise.all([
    q.get(),
    rtdb.ref(`/responder_index/${filter.municipalityId}`).get(),
  ])

  const shift = (shiftSnap.val() ?? {}) as Record<string, { isOnShift?: boolean }>

  return respondersSnap.docs
    .filter((doc) => shift[doc.id]?.isOnShift === true)
    .map((doc) => {
      const data = doc.data()
      return {
        uid: doc.id,
        displayName: String(data.displayName ?? ''),
        agencyId: String(data.agencyId ?? ''),
        municipalityId: data.municipalityId as string,
      }
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}

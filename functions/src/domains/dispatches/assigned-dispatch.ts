import type { Firestore, Transaction } from 'firebase-admin/firestore'
import { BantayogError, BantayogErrorCode } from '@bantayog/shared-validators'

const ACTIVE_STATES = ['accepted', 'acknowledged', 'en_route', 'on_scene']

export interface AssignedDispatch {
  status: string
  assignedTo: { uid: string; agencyId: string; municipalityId: string }
  reportId: string
}

// Reads a dispatch inside `tx` and asserts the caller is its assigned
// responder and the dispatch is still active (accepted through on_scene).
export async function readActiveAssignedDispatch(
  db: Firestore,
  tx: Transaction,
  dispatchId: string,
  uid: string,
): Promise<AssignedDispatch> {
  const dispatchSnap = await tx.get(db.collection('dispatches').doc(dispatchId))
  if (!dispatchSnap.exists) {
    throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Dispatch not found')
  }

  const dispatch = dispatchSnap.data() as Partial<AssignedDispatch> & { status: string }
  if (dispatch.assignedTo?.uid !== uid) {
    throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'Not assigned to this dispatch')
  }
  if (!ACTIVE_STATES.includes(dispatch.status)) {
    throw new BantayogError(
      BantayogErrorCode.FAILED_PRECONDITION,
      `Dispatch must be active (current: ${dispatch.status})`,
    )
  }
  return dispatch as AssignedDispatch
}

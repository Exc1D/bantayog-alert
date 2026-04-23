import type { Database } from 'firebase-admin/database'
import type { Transaction, Timestamp } from 'firebase-admin/firestore'
import {
  BantayogError,
  BantayogErrorCode,
  isValidReportTransition,
} from '@bantayog/shared-validators'

export interface DispatchResponderCoreDeps {
  reportId: string
  responderUid: string
  idempotencyKey: string
  actor: { uid: string; claims: { role?: string; municipalityId?: string } }
  now: Timestamp
}

export async function assertResponderOnShift(
  rtdb: Database,
  municipalityId: string,
  responderUid: string,
  message = 'Responder is not on shift',
): Promise<void> {
  const shiftSnap = await rtdb.ref(`/responder_index/${municipalityId}/${responderUid}`).get()
  const shiftData = shiftSnap.val() as { isOnShift?: boolean } | null
  if (shiftData?.isOnShift !== true) {
    throw new BantayogError(BantayogErrorCode.INVALID_STATUS_TRANSITION, message, {
      responderUid,
    })
  }
}

interface ValidateDispatchTransactionArgs {
  tx: Transaction
  rtdb: Database
  deps: DispatchResponderCoreDeps
  reportRef: FirebaseFirestore.DocumentReference
  responderRef: FirebaseFirestore.DocumentReference
}

export async function validateDispatchTransaction({
  tx,
  rtdb,
  deps,
  reportRef,
  responderRef,
}: ValidateDispatchTransactionArgs): Promise<{
  report: Record<string, unknown>
  responder: { agencyId: string; municipalityId: string } & Record<string, unknown>
  from: 'verified'
}> {
  const [reportSnap, responderSnap] = await Promise.all([tx.get(reportRef), tx.get(responderRef)])

  if (!deps.actor.claims.municipalityId) {
    throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, 'municipalityId is required')
  }

  if (!reportSnap.exists) {
    throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Report not found')
  }
  if (!responderSnap.exists) {
    throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Responder not found')
  }
  const report = reportSnap.data() as Record<string, unknown>
  const responder = responderSnap.data() as Record<string, unknown>

  if (typeof report.municipalityId !== 'string' || !report.municipalityId) {
    throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, 'Report missing municipalityId')
  }
  if (typeof responder.municipalityId !== 'string' || !responder.municipalityId) {
    throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, 'Responder missing municipalityId')
  }
  if (report.municipalityId !== deps.actor.claims.municipalityId) {
    throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'Report not in your municipality')
  }
  if (responder.municipalityId !== deps.actor.claims.municipalityId) {
    throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'Responder not in your municipality')
  }
  if (responder.isActive !== true) {
    throw new BantayogError(BantayogErrorCode.INVALID_STATUS_TRANSITION, 'Responder is not active')
  }
  if (typeof responder.agencyId !== 'string' || !responder.agencyId) {
    throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, 'Responder missing agencyId')
  }

  // Re-check shift status after identity + municipality checks to preserve correct error classes.
  await assertResponderOnShift(
    rtdb,
    deps.actor.claims.municipalityId,
    deps.responderUid,
    'Responder went off-shift before dispatch could be created',
  )

  const rawStatus = report.status
  if (typeof rawStatus !== 'string') {
    throw new BantayogError(
      BantayogErrorCode.INVALID_STATUS_TRANSITION,
      'Report status is not a string',
    )
  }
  const from = rawStatus as 'verified'
  const to = 'assigned' as const
  if (!isValidReportTransition(from, to)) {
    throw new BantayogError(
      BantayogErrorCode.INVALID_STATUS_TRANSITION,
      `Cannot dispatch from status ${from}`,
    )
  }

  // After validation, we know these fields exist and have correct types.
  // Spread first so validated fields always win if keys overlap.
  const validatedResponder = {
    ...responder,
    agencyId: responder.agencyId,
    municipalityId: responder.municipalityId,
  }

  return { report, responder: validatedResponder, from }
}

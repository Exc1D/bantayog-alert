import type { Transaction, DocumentReference } from 'firebase-admin/firestore'
import type { DispatchResponderCoreDeps } from './dispatch-responder-validation.js'

interface WriteDispatchDocsArgs {
  tx: Transaction
  deps: DispatchResponderCoreDeps
  dispatchRef: DocumentReference
  reportRef: DocumentReference
  reportEvRef: DocumentReference
  dispatchEvRef: DocumentReference
  responder: { agencyId: string; municipalityId: string } & Record<string, unknown>
  deadlineMs: number
  correlationId: string
  idempotencyPayloadHash: string
  from: 'verified'
  to: 'assigned'
}

export function writeDispatchDocs(args: WriteDispatchDocsArgs): void {
  const {
    tx,
    deps,
    dispatchRef,
    reportRef,
    reportEvRef,
    dispatchEvRef,
    responder,
    deadlineMs,
    correlationId,
    idempotencyPayloadHash,
    from,
    to,
  } = args
  const dispatchId = dispatchRef.id
  const nowMillis = deps.now.toMillis()
  const actorRole = deps.actor.claims.role === 'agency_admin' ? 'agency_admin' : 'municipal_admin'

  tx.set(dispatchRef, {
    dispatchId,
    reportId: deps.reportId,
    status: 'pending',
    municipalityId: responder.municipalityId,
    assignedTo: {
      uid: deps.responderUid,
      agencyId: responder.agencyId,
      municipalityId: responder.municipalityId,
    },
    dispatchedAt: nowMillis,
    dispatchedBy: deps.actor.uid,
    dispatchedByRole: actorRole,
    statusUpdatedAt: nowMillis,
    lastStatusAt: nowMillis,
    acknowledgementDeadlineAt: nowMillis + deadlineMs,
    correlationId,
    idempotencyKey: deps.idempotencyKey,
    idempotencyPayloadHash,
    schemaVersion: 1,
  })

  tx.update(reportRef, {
    status: to,
    lastStatusAt: nowMillis,
    lastStatusBy: deps.actor.uid,
    currentDispatchId: dispatchId,
  })

  tx.set(reportEvRef, {
    eventId: reportEvRef.id,
    reportId: deps.reportId,
    from,
    to,
    actor: deps.actor.uid,
    actorRole,
    at: nowMillis,
    correlationId,
    schemaVersion: 1,
  })

  tx.set(dispatchEvRef, {
    eventId: dispatchEvRef.id,
    dispatchId,
    reportId: deps.reportId,
    from: null,
    to: 'pending',
    actor: deps.actor.uid,
    actorRole,
    at: nowMillis,
    correlationId,
    schemaVersion: 1,
  })
}

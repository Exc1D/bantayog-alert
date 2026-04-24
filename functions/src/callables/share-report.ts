import { onCall, type CallableRequest, HttpsError } from 'firebase-functions/v2/https'
import { Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import { adminDb } from '../admin-init.js'
import { withIdempotency } from '../idempotency/guard.js'
import { bantayogErrorToHttps, requireAuth } from './https-error.js'

const requestSchema = z
  .object({
    reportId: z.string().min(1).max(128),
    targetMunicipalityId: z.string().min(1).max(64),
    reason: z.string().max(500).optional(),
    idempotencyKey: z.uuid(),
  })
  .strict()

export interface ShareReportDeps {
  reportId: string
  targetMunicipalityId: string
  reason?: string
  idempotencyKey: string
  actor: { uid: string; claims: Record<string, unknown> }
  now: Timestamp
}

interface OpsDoc {
  municipalityId: string
  visibility?: {
    scope?: string
    sharedWith?: string[]
  }
}

export async function shareReportCore(
  db: FirebaseFirestore.Firestore,
  deps: ShareReportDeps,
): Promise<{ status: 'shared' }> {
  const { reportId, targetMunicipalityId, reason, idempotencyKey, actor, now } = deps
  const nowMs = now.toMillis()

  const claims = actor.claims
  const role = typeof claims.role === 'string' ? claims.role : ''
  const accountStatus = typeof claims.accountStatus === 'string' ? claims.accountStatus : ''
  const municipalityId =
    typeof claims.municipalityId === 'string' ? claims.municipalityId : undefined

  const isSuperadmin = role === 'provincial_superadmin'
  const isMuniAdmin = role === 'municipal_admin'
  if ((!isMuniAdmin && !isSuperadmin) || accountStatus !== 'active') {
    throw new HttpsError('permission-denied', 'municipal_admin or superadmin required')
  }

  const opsSnap = await db.collection('report_ops').doc(reportId).get()
  if (!opsSnap.exists) throw new HttpsError('not-found', 'report not found')
  const ops = opsSnap.data() as OpsDoc

  if (isMuniAdmin && municipalityId !== undefined && ops.municipalityId !== municipalityId) {
    throw new HttpsError('permission-denied', 'report belongs to a different municipality')
  }

  const sharingRef = db.collection('report_sharing').doc(reportId)
  const threadRef = db.collection('command_channel_threads').doc()
  const eventRef = sharingRef.collection('events').doc()
  const opsRef = db.collection('report_ops').doc(reportId)

  const { result } = await withIdempotency(
    db,
    {
      key: `shareReport:${actor.uid}:${idempotencyKey}`,
      payload: { reportId, targetMunicipalityId },
      now: () => nowMs,
    },
    async () => {
      const existingSnap = await db.collection('report_sharing').doc(reportId).get()
      const existingData = existingSnap.data()
      const existing = existingData?.sharedWith as string[] | undefined
      if (existing?.includes(targetMunicipalityId)) {
        return { alreadyShared: true }
      }

      const mergedSharedWith = existing
        ? [...new Set([...existing, targetMunicipalityId])]
        : [targetMunicipalityId]

      const opsReadSnap = await opsRef.get()
      const opsData = opsReadSnap.data() as OpsDoc | undefined
      const currentScope = opsData?.visibility?.scope ?? 'municipality'
      const currentShared = opsData?.visibility?.sharedWith ?? []
      void currentScope

      // eslint-disable-next-line @typescript-eslint/require-await
      await db.runTransaction(async (tx) => {
        tx.set(
          sharingRef,
          {
            ownerMunicipalityId: ops.municipalityId,
            reportId,
            sharedWith: mergedSharedWith,
            updatedAt: nowMs,
            schemaVersion: 1,
          },
          { merge: true },
        )
        tx.set(eventRef, {
          targetMunicipalityId,
          sharedBy: actor.uid,
          sharedAt: nowMs,
          ...(reason ? { sharedReason: reason } : {}),
          source: 'manual',
          schemaVersion: 1,
        })
        tx.set(threadRef, {
          threadId: threadRef.id,
          reportId,
          threadType: 'border_share',
          subject: `Shared report ${reportId} with ${targetMunicipalityId}`,
          participantUids: { [actor.uid]: true },
          createdBy: actor.uid,
          createdAt: nowMs,
          updatedAt: nowMs,
          schemaVersion: 1,
        })
        tx.update(opsRef, {
          'visibility.scope': 'shared',
          'visibility.sharedWith': [...new Set([...currentShared, targetMunicipalityId])],
          updatedAt: nowMs,
        })
      })
      return { alreadyShared: false }
    },
  )
  void result
  return { status: 'shared' }
}

export const shareReport = onCall(
  { region: 'asia-southeast1', enforceAppCheck: process.env.NODE_ENV === 'production' },
  async (req: CallableRequest) => {
    const actor = requireAuth(req, ['municipal_admin', 'provincial_superadmin'])
    const input = requestSchema.parse(req.data)
    try {
      const { reason, ...rest } = input
      return await shareReportCore(adminDb, {
        ...rest,
        ...(reason !== undefined ? { reason } : {}),
        actor,
        now: Timestamp.now(),
      })
    } catch (err: unknown) {
      throw bantayogErrorToHttps(err as Parameters<typeof bantayogErrorToHttps>[0])
    }
  },
)

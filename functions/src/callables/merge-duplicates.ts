import { onCall, HttpsError, type FunctionsErrorCode } from 'firebase-functions/v2/https'
import { z } from 'zod'
import { adminDb } from '../admin-init.js'
import { requireAuth, bantayogErrorToHttps } from './https-error.js'
import { withIdempotency } from '../idempotency/guard.js'
import { logDimension } from '@bantayog/shared-validators'

const log = logDimension('mergeDuplicates')

const inputSchema = z.object({
  primaryReportId: z.string().min(1),
  duplicateReportIds: z.array(z.string().min(1)).min(1).max(50),
  idempotencyKey: z.uuid(),
})

export interface MergeDuplicatesActor {
  uid: string
  claims: { role: string; municipalityId?: string; active: boolean; auth_time: number }
}

export interface MergeDuplicatesResult {
  success: boolean
  mergedCount?: number
  errorCode?: string
}

interface OpsRow {
  id: string
  municipalityId?: string
  duplicateClusterId?: string
  [key: string]: unknown
}

export async function mergeDuplicatesCore(
  db: FirebaseFirestore.Firestore,
  input: z.infer<typeof inputSchema>,
  actor: MergeDuplicatesActor,
): Promise<MergeDuplicatesResult> {
  if (actor.claims.role !== 'municipal_admin' && actor.claims.role !== 'provincial_superadmin') {
    return { success: false, errorCode: 'permission-denied' }
  }

  const { primaryReportId, duplicateReportIds, idempotencyKey } = input
  const allIds = [primaryReportId, ...duplicateReportIds]

  const opsSnaps = await Promise.all(allIds.map((id) => db.collection('report_ops').doc(id).get()))
  const opsData: OpsRow[] = opsSnaps.map((s) => {
    const d = s.data()
    return { id: s.id, ...(d ?? {}) }
  })

  const municipalities = new Set(opsData.map((d) => d.municipalityId))
  if (municipalities.size > 1) {
    return { success: false, errorCode: 'invalid-argument' }
  }

  const clusterIds = new Set(
    opsData.filter((d) => d.duplicateClusterId).map((d) => d.duplicateClusterId),
  )
  if (clusterIds.size > 1) {
    return { success: false, errorCode: 'failed-precondition' }
  }

  const { result: cached } = await withIdempotency(
    db,
    { key: `merge-duplicates:${idempotencyKey}`, payload: input },
    async () => {
      const reportSnaps = await Promise.all(
        allIds.map((id) => db.collection('reports').doc(id).get()),
      )
      const primaryReportData = reportSnaps.find((s) => s.id === primaryReportId)?.data()

      const allMediaRefs = new Set<string>(
        (primaryReportData?.mediaRefs as string[] | undefined) ?? [],
      )
      for (const s of reportSnaps) {
        if (s.id === primaryReportId) continue
        for (const ref of s.data()?.mediaRefs ?? []) {
          allMediaRefs.add(ref as string)
        }
      }

      const batch = db.batch()

      batch.update(db.collection('reports').doc(primaryReportId), {
        mediaRefs: Array.from(allMediaRefs),
        updatedAt: Date.now(),
      })

      for (const dupId of duplicateReportIds) {
        batch.update(db.collection('reports').doc(dupId), {
          status: 'merged_as_duplicate',
          mergedInto: primaryReportId,
          updatedAt: Date.now(),
        })
        batch.update(db.collection('report_ops').doc(dupId), {
          status: 'merged_as_duplicate',
          updatedAt: Date.now(),
        })
      }

      await batch.commit()
      log({
        severity: 'INFO',
        code: 'merge.complete',
        message: `Merged ${String(duplicateReportIds.length)} duplicates into ${primaryReportId}`,
      })

      return { success: true, mergedCount: duplicateReportIds.length }
    },
  )

  return cached
}

export const mergeDuplicates = onCall(
  { region: 'asia-southeast1', enforceAppCheck: process.env.NODE_ENV === 'production' },
  async (request) => {
    const actor = requireAuth(request, ['municipal_admin', 'provincial_superadmin'])
    const input = inputSchema.safeParse(request.data)
    if (!input.success) throw new HttpsError('invalid-argument', input.error.message)

    let result: MergeDuplicatesResult
    try {
      const claims: MergeDuplicatesActor['claims'] = {
        role: actor.claims.role as string,
        active: actor.claims.active as boolean,
        auth_time: actor.claims.auth_time as number,
      }
      if (typeof actor.claims.municipalityId === 'string') {
        claims.municipalityId = actor.claims.municipalityId
      }
      result = await mergeDuplicatesCore(adminDb, input.data, { uid: actor.uid, claims })
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err) {
        throw bantayogErrorToHttps(err as Parameters<typeof bantayogErrorToHttps>[0])
      }
      throw err
    }

    if (!result.success) {
      throw new HttpsError(result.errorCode as FunctionsErrorCode, 'merge failed')
    }
    return result
  },
)

import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { Timestamp, type Firestore } from 'firebase-admin/firestore'
import { z } from 'zod'
import { adminDb } from '../../admin-init.js'
import { shouldEnforceAppCheck } from '../shared/app-check-config.js'
import { checkRateLimit } from '../shared/rate-limit.js'
import { getCitizenCallableCorsOrigins } from '../shared/callable-config.js'

// Mirrors the retired validSituationUpdate() client-write rule; direct
// client creates on situation_updates are now `allow create: if false`.
export const inputSchema = z
  .object({
    municipalityId: z.string().trim().min(2).max(80),
    municipalityLabel: z.string().trim().min(2).max(80),
    barangayLabel: z.string().trim().max(80).optional(),
    hazardType: z.enum([
      'typhoon',
      'flood',
      'storm_surge',
      'landslide',
      'earthquake',
      'fire',
      'medical',
      'power_outage',
      'road_blocked',
      'other',
    ]),
    condition: z.enum([
      'safe',
      'light_rain',
      'heavy_rain',
      'flooding',
      'strong_wind',
      'needs_help',
      'blocked_road',
      'power_outage',
      'other',
    ]),
    body: z.string().trim().min(3).max(500),
  })
  .strict()

export type CreateSituationUpdateInput = z.infer<typeof inputSchema>

export async function createSituationUpdateCore(
  db: Firestore,
  args: { uid: string; input: CreateSituationUpdateInput; now: number },
): Promise<{ updateId: string }> {
  const { barangayLabel, ...rest } = args.input
  const doc = {
    authorUid: args.uid,
    createdAt: args.now,
    ...rest,
    // exactOptionalPropertyTypes: omit blank/absent optional keys entirely.
    ...(barangayLabel !== undefined && barangayLabel !== '' ? { barangayLabel } : {}),
    visibility: 'public' as const,
    reportedCount: 0,
  }
  const ref = await db.collection('situation_updates').add(doc)
  return { updateId: ref.id }
}

export const createSituationUpdate = onCall(
  {
    region: 'asia-southeast1',
    cors: getCitizenCallableCorsOrigins(),
    enforceAppCheck: shouldEnforceAppCheck(),
    maxInstances: 50,
  },
  async (request) => {
    // Auth parity with the removed rule: any active signed-in account
    // (registered or pseudonymous), no role gate.
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in to post an update.')
    }
    if (request.auth.token.accountStatus !== 'active') {
      throw new HttpsError('permission-denied', 'Account is not active.')
    }

    const parsed = inputSchema.safeParse(request.data)
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', 'Invalid situation update payload.')
    }

    const rl = await checkRateLimit(adminDb, {
      key: `createSituationUpdate:${request.auth.uid}`,
      limit: 5,
      windowSeconds: 600,
      now: Timestamp.now(),
    })
    if (!rl.allowed) {
      throw new HttpsError('resource-exhausted', 'Too many posts. Try again in a few minutes.')
    }

    return createSituationUpdateCore(adminDb, {
      uid: request.auth.uid,
      input: parsed.data,
      now: Date.now(),
    })
  },
)

import { onCall } from 'firebase-functions/v2/https'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { requireAuth } from './https-error.js'
import { streamAuditEvent } from '../services/audit-stream.js'

const upsertSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1).max(200),
  type: z.string().min(1).max(100),
  quantity: z.number().int().nonnegative(),
  unit: z.string().min(1).max(50),
  location: z.string().min(1).max(300),
  available: z.boolean(),
})

export async function upsertProvincialResourceCore(
  db: Firestore,
  input: unknown,
  actor: { uid: string },
): Promise<{ id: string }> {
  const validated = upsertSchema.parse(input)
  const id = validated.id ?? randomUUID()
  const now = Date.now()

  const existingDoc = await db.collection('provincial_resources').doc(id).get()
  const existingArchived = existingDoc.exists
    ? (existingDoc.data() as { archived?: boolean }).archived
    : false

  await db.collection('provincial_resources').doc(id).set({
    id,
    name: validated.name,
    type: validated.type,
    quantity: validated.quantity,
    unit: validated.unit,
    location: validated.location,
    available: validated.available,
    archived: existingArchived,
    lastUpdatedBy: actor.uid,
    lastUpdatedAt: now,
    schemaVersion: 1,
  })

  void streamAuditEvent({
    eventType: 'provincial_resource_upserted',
    actorUid: actor.uid,
    targetCollection: 'provincial_resources',
    targetDocumentId: id,
    occurredAt: now,
  })

  return { id }
}

export const upsertProvincialResource = onCall(
  { region: 'asia-southeast1', enforceAppCheck: true },
  async (request) => {
    const { uid } = requireAuth(request, ['superadmin', 'pdrrmo'])
    return upsertProvincialResourceCore(getFirestore(), request.data, { uid })
  },
)

export async function archiveProvincialResourceCore(
  db: Firestore,
  input: { id: string },
  actor: { uid: string },
): Promise<void> {
  await db.collection('provincial_resources').doc(input.id).update({
    archived: true,
    archivedBy: actor.uid,
    archivedAt: Date.now(),
  })
  void streamAuditEvent({
    eventType: 'provincial_resource_archived',
    actorUid: actor.uid,
    targetCollection: 'provincial_resources',
    targetDocumentId: input.id,
    occurredAt: Date.now(),
  })
}

export const archiveProvincialResource = onCall(
  { region: 'asia-southeast1', enforceAppCheck: true },
  async (request) => {
    const { uid } = requireAuth(request, ['superadmin', 'pdrrmo'])
    return archiveProvincialResourceCore(getFirestore(), request.data as { id: string }, { uid })
  },
)

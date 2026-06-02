import { addDoc, collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import type { QueryDocumentSnapshot, Unsubscribe } from 'firebase/firestore'
import { db, ensureSignedIn } from './firebase.js'

const COLLECTION = 'situation_updates'
const FEED_LIMIT = 100

export const SITUATION_HAZARD_TYPES = [
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
] as const

export const SITUATION_CONDITIONS = [
  'safe',
  'light_rain',
  'heavy_rain',
  'flooding',
  'strong_wind',
  'needs_help',
  'blocked_road',
  'power_outage',
  'other',
] as const

const HAZARD_TYPE_SET: ReadonlySet<string> = new Set(SITUATION_HAZARD_TYPES)
const CONDITION_SET: ReadonlySet<string> = new Set(SITUATION_CONDITIONS)

export type SituationHazardType = (typeof SITUATION_HAZARD_TYPES)[number]
export type SituationCondition = (typeof SITUATION_CONDITIONS)[number]

export interface SituationUpdate {
  id: string
  authorUid: string
  createdAt: number
  updatedAt?: number
  municipalityId: string
  municipalityLabel: string
  barangayLabel?: string
  hazardType: SituationHazardType
  condition: SituationCondition
  body: string
  visibility: 'public'
  reportedCount?: number
}

export interface SituationUpdateInput {
  municipalityId: string
  municipalityLabel: string
  barangayLabel?: string
  hazardType: SituationHazardType
  condition: SituationCondition
  body: string
}

function isSituationHazardType(value: unknown): value is SituationHazardType {
  return typeof value === 'string' && HAZARD_TYPE_SET.has(value)
}

function isSituationCondition(value: unknown): value is SituationCondition {
  return typeof value === 'string' && CONDITION_SET.has(value)
}

function mapSituationUpdateDoc(docSnap: QueryDocumentSnapshot): SituationUpdate | null {
  const raw: unknown = docSnap.data()
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>
  if (
    typeof data.authorUid !== 'string' ||
    typeof data.createdAt !== 'number' ||
    !Number.isFinite(data.createdAt) ||
    typeof data.municipalityId !== 'string' ||
    typeof data.municipalityLabel !== 'string' ||
    !isSituationHazardType(data.hazardType) ||
    !isSituationCondition(data.condition) ||
    typeof data.body !== 'string' ||
    data.visibility !== 'public'
  ) {
    return null
  }

  const update: SituationUpdate = {
    id: docSnap.id,
    authorUid: data.authorUid,
    createdAt: data.createdAt,
    municipalityId: data.municipalityId,
    municipalityLabel: data.municipalityLabel,
    hazardType: data.hazardType,
    condition: data.condition,
    body: data.body,
    visibility: 'public',
  }
  if (typeof data.updatedAt === 'number' && Number.isFinite(data.updatedAt)) {
    update.updatedAt = data.updatedAt
  }
  if (typeof data.barangayLabel === 'string' && data.barangayLabel.trim()) {
    update.barangayLabel = data.barangayLabel
  }
  if (typeof data.reportedCount === 'number' && Number.isFinite(data.reportedCount)) {
    update.reportedCount = data.reportedCount
  }
  return update
}

function normalizeInput(input: SituationUpdateInput): SituationUpdateInput {
  const body = input.body.trim()
  const barangayLabel = input.barangayLabel?.trim()
  if (body.length < 3 || body.length > 500) {
    throw new Error('Situation update body must be 3 to 500 characters.')
  }
  if (!input.municipalityLabel.trim()) {
    throw new Error('Municipality is required.')
  }
  if (!input.municipalityId.trim()) {
    throw new Error('Municipality ID is required.')
  }
  return {
    municipalityId: input.municipalityId.trim(),
    municipalityLabel: input.municipalityLabel.trim(),
    ...(barangayLabel ? { barangayLabel } : {}),
    hazardType: input.hazardType,
    condition: input.condition,
    body,
  }
}

export function subscribeSituationUpdates(
  onNext: (updates: SituationUpdate[]) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  const q = query(
    collection(db(), COLLECTION),
    where('visibility', '==', 'public'),
    orderBy('createdAt', 'desc'),
    limit(FEED_LIMIT),
  )
  return onSnapshot(
    q,
    (snap) => {
      const updates: SituationUpdate[] = []
      for (const docSnap of snap.docs) {
        const update = mapSituationUpdateDoc(docSnap)
        if (!update) {
          console.error('Skipping invalid situation update document', docSnap.id)
          continue
        }
        updates.push(update)
      }
      updates.sort((a, b) => b.createdAt - a.createdAt)
      onNext(updates)
    },
    (error) => {
      onError?.(error)
    },
  )
}

export async function createSituationUpdate(input: SituationUpdateInput): Promise<string> {
  const uid = await ensureSignedIn()
  const normalized = normalizeInput(input)
  const docRef = await addDoc(collection(db(), COLLECTION), {
    authorUid: uid,
    createdAt: Date.now(),
    ...normalized,
    visibility: 'public',
    reportedCount: 0,
  })
  return docRef.id
}

export async function reportSituationUpdate(
  updateId: string,
  reason = 'Needs review',
): Promise<string> {
  const uid = await ensureSignedIn()
  const normalizedReason = reason.trim() || 'Needs review'
  const docRef = await addDoc(collection(db(), COLLECTION, updateId, 'reports'), {
    reporterUid: uid,
    reason: normalizedReason.slice(0, 120),
    createdAt: Date.now(),
  })
  return docRef.id
}

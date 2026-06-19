import type { UserRole } from '@bantayog/shared-types'

export type MergeDuplicatesErrorCode =
  | 'permission-denied'
  | 'not-found'
  | 'failed-precondition'
  | 'invalid-argument'
  | 'resource-exhausted'
  | 'already-exists'

export type MergePolicyResult<T extends object = object> =
  | ({ success: true } & T)
  | { success: false; errorCode: MergeDuplicatesErrorCode; reason?: 'role' | 'inactive' }

export interface MergeActorClaims {
  role: UserRole
  municipalityId?: string
  active: boolean
}

export interface MergeOpsRow {
  id: string
  municipalityId?: string
  duplicateClusterId?: string
}

export interface MergeReportRow {
  id: string
  mediaRefs?: unknown
}

export interface BuildMergeEventDataInput {
  eventId: string
  primaryReportId: string
  actorUid: string
  actorRole: UserRole
  at: unknown
  correlationId: string
  duplicateReportIds: string[]
}

export function hasUniqueDuplicateReportIds(duplicateReportIds: string[]): boolean {
  return new Set(duplicateReportIds).size === duplicateReportIds.length
}

export function excludesPrimaryReportId(
  primaryReportId: string,
  duplicateReportIds: string[],
): boolean {
  return !duplicateReportIds.includes(primaryReportId)
}

export function validateMergeActorClaims(claims: MergeActorClaims): MergePolicyResult {
  if (claims.role !== 'municipal_admin' && claims.role !== 'provincial_superadmin') {
    return { success: false, errorCode: 'permission-denied', reason: 'role' }
  }
  if (!claims.active) {
    return { success: false, errorCode: 'permission-denied', reason: 'inactive' }
  }
  return { success: true }
}

export function validateMergeOpsRows(
  opsData: MergeOpsRow[],
  actorClaims: Pick<MergeActorClaims, 'role' | 'municipalityId'>,
): MergePolicyResult<{ municipalityId: string; duplicateClusterId: string }> {
  const municipalityIds = opsData.map((row) => row.municipalityId?.trim())
  const missingMunicipality = municipalityIds.some((municipalityId) => !municipalityId)
  if (missingMunicipality) {
    return { success: false, errorCode: 'failed-precondition' }
  }

  const municipalities = new Set(municipalityIds)
  if (municipalities.size !== 1) {
    return { success: false, errorCode: 'invalid-argument' }
  }

  const municipalityId = municipalityIds[0]
  if (!municipalityId) {
    return { success: false, errorCode: 'failed-precondition' }
  }

  const clusterIds = opsData
    .map((row) => row.duplicateClusterId?.trim())
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
  if (clusterIds.length !== opsData.length) {
    return { success: false, errorCode: 'failed-precondition' }
  }

  const duplicateClusterId = clusterIds[0]
  if (!duplicateClusterId || new Set(clusterIds).size !== 1) {
    return { success: false, errorCode: 'failed-precondition' }
  }

  if (actorClaims.role === 'municipal_admin' && actorClaims.municipalityId !== municipalityId) {
    return { success: false, errorCode: 'permission-denied' }
  }

  return { success: true, municipalityId, duplicateClusterId }
}

export function buildPrimaryMergeReportUpdate(
  primaryReportId: string,
  reportRows: MergeReportRow[],
): { mediaRefs: string[] } {
  const mediaRefs = new Set<string>()
  const primary = reportRows.find((row) => row.id === primaryReportId)
  addMediaRefs(mediaRefs, primary?.mediaRefs)

  for (const row of reportRows) {
    if (row.id === primaryReportId) continue
    addMediaRefs(mediaRefs, row.mediaRefs)
  }

  return { mediaRefs: Array.from(mediaRefs) }
}

export function buildMergeDuplicateReportUpdate(primaryReportId: string): {
  status: 'merged_as_duplicate'
  mergedInto: string
} {
  return {
    status: 'merged_as_duplicate',
    mergedInto: primaryReportId,
  }
}

export function buildMergeEventData(input: BuildMergeEventDataInput): {
  eventId: string
  reportId: string
  eventType: 'merge_duplicates'
  actor: string
  actorRole: UserRole
  at: unknown
  correlationId: string
  schemaVersion: 1
  mergedCount: number
  mergedDuplicateIds: string[]
} {
  return {
    eventId: input.eventId,
    reportId: input.primaryReportId,
    eventType: 'merge_duplicates',
    actor: input.actorUid,
    actorRole: input.actorRole,
    at: input.at,
    correlationId: input.correlationId,
    schemaVersion: 1,
    mergedCount: input.duplicateReportIds.length,
    mergedDuplicateIds: input.duplicateReportIds,
  }
}

function addMediaRefs(mediaRefs: Set<string>, value: unknown): void {
  if (!Array.isArray(value)) return
  for (const ref of value) {
    if (typeof ref === 'string') {
      mediaRefs.add(ref)
    }
  }
}

import { BantayogError, BantayogErrorCode } from '@bantayog/shared-validators'

const TERMINAL_DISPATCH_STATES = ['declined', 'timed_out', 'cancelled'] as const

const DEADLINE_BY_SEVERITY: Record<'critical' | 'high' | 'low' | 'medium', number> = {
  critical: 5 * 60 * 1000,
  high: 5 * 60 * 1000,
  medium: 15 * 60 * 1000,
  low: 30 * 60 * 1000,
}

export interface RedispatchActorClaims {
  municipalityId?: string
  permittedMunicipalityIds?: string[]
}

export interface BuildRedispatchDispatchDataInput {
  newDispatchId: string
  reportId: string
  newResponderUid: string
  responderAgencyId: string
  responderMunicipalityId: string
  actorUid: string
  nowMillis: number
  deadlineMs: number
  correlationId: string
}

export interface RedispatchResponderData {
  agencyId?: unknown
  municipalityId?: unknown
  isActive?: unknown
}

export function assertRedispatchTerminalStatus(status: string): void {
  if (TERMINAL_DISPATCH_STATES.includes(status as (typeof TERMINAL_DISPATCH_STATES)[number])) {
    return
  }
  throw new BantayogError(
    BantayogErrorCode.FAILED_PRECONDITION,
    `Cannot redispatch from status ${status} (must be terminal)`,
  )
}

export function assertReportInActorMunicipality(
  actorMunicipalityIds: string[],
  reportMunicipalityId: unknown,
): void {
  if (typeof reportMunicipalityId !== 'string' || !reportMunicipalityId) {
    throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, 'Report missing municipalityId')
  }

  if (actorMunicipalityIds.length > 0 && !actorMunicipalityIds.includes(reportMunicipalityId)) {
    throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'Report not in your municipality')
  }
}

export function assertVerifiedReportStatus(status: unknown): void {
  if (status === 'verified') return
  throw new BantayogError(
    BantayogErrorCode.FAILED_PRECONDITION,
    `Report must be verified to redispatch (current: ${String(status)})`,
  )
}

export function assertRedispatchResponderData(
  responder: RedispatchResponderData,
): asserts responder is { agencyId: string; municipalityId: string; isActive: true } {
  if (typeof responder.municipalityId !== 'string' || !responder.municipalityId) {
    throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, 'Responder missing municipalityId')
  }
  if (typeof responder.agencyId !== 'string' || !responder.agencyId) {
    throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, 'Responder missing agencyId')
  }
  if (responder.isActive !== true) {
    throw new BantayogError(BantayogErrorCode.INVALID_STATUS_TRANSITION, 'Responder is not active')
  }
}

export function assertResponderInReportMunicipality(
  responderMunicipalityId: string,
  reportMunicipalityId: string,
): void {
  if (responderMunicipalityId === reportMunicipalityId) return
  throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'Responder not in report municipality')
}

export function getActorMunicipalityIds(claims: RedispatchActorClaims): string[] {
  const actorMuniIds: string[] = []
  if (claims.municipalityId) {
    actorMuniIds.push(claims.municipalityId)
  }
  if (claims.permittedMunicipalityIds?.length) {
    actorMuniIds.push(...claims.permittedMunicipalityIds)
  }
  return actorMuniIds
}

export function getRedispatchDeadlineMs(severity: unknown): number {
  if (typeof severity === 'string' && Object.hasOwn(DEADLINE_BY_SEVERITY, severity)) {
    return DEADLINE_BY_SEVERITY[severity as keyof typeof DEADLINE_BY_SEVERITY]
  }
  return DEADLINE_BY_SEVERITY.medium
}

export function buildRedispatchDispatchData(input: BuildRedispatchDispatchDataInput) {
  return {
    dispatchId: input.newDispatchId,
    reportId: input.reportId,
    status: 'pending' as const,
    assignedTo: {
      uid: input.newResponderUid,
      agencyId: input.responderAgencyId,
      municipalityId: input.responderMunicipalityId,
    },
    dispatchedAt: input.nowMillis,
    dispatchedBy: input.actorUid,
    lastStatusAt: input.nowMillis,
    acknowledgementDeadlineAt: input.nowMillis + input.deadlineMs,
    correlationId: input.correlationId,
    schemaVersion: 1,
  }
}

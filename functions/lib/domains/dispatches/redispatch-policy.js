import { BantayogError, BantayogErrorCode } from '@bantayog/shared-validators';
const TERMINAL_DISPATCH_STATES = ['declined', 'timed_out', 'cancelled'];
const DEADLINE_BY_SEVERITY = {
    critical: 5 * 60 * 1000,
    high: 5 * 60 * 1000,
    medium: 15 * 60 * 1000,
    low: 30 * 60 * 1000,
};
export function assertRedispatchTerminalStatus(status) {
    if (TERMINAL_DISPATCH_STATES.includes(status)) {
        return;
    }
    throw new BantayogError(BantayogErrorCode.FAILED_PRECONDITION, `Cannot redispatch from status ${status} (must be terminal)`);
}
export function assertReportInActorMunicipality(actorMunicipalityIds, reportMunicipalityId) {
    if (typeof reportMunicipalityId !== 'string' || !reportMunicipalityId) {
        throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, 'Report missing municipalityId');
    }
    if (actorMunicipalityIds.length > 0 && !actorMunicipalityIds.includes(reportMunicipalityId)) {
        throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'Report not in your municipality');
    }
}
export function assertVerifiedReportStatus(status) {
    if (status === 'verified')
        return;
    throw new BantayogError(BantayogErrorCode.FAILED_PRECONDITION, `Report must be verified to redispatch (current: ${String(status)})`);
}
export function assertRedispatchResponderData(responder) {
    if (typeof responder.municipalityId !== 'string' || !responder.municipalityId) {
        throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, 'Responder missing municipalityId');
    }
    if (typeof responder.agencyId !== 'string' || !responder.agencyId) {
        throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, 'Responder missing agencyId');
    }
    if (responder.isActive !== true) {
        throw new BantayogError(BantayogErrorCode.INVALID_STATUS_TRANSITION, 'Responder is not active');
    }
}
export function assertResponderInReportMunicipality(responderMunicipalityId, reportMunicipalityId) {
    if (responderMunicipalityId === reportMunicipalityId)
        return;
    throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'Responder not in report municipality');
}
export function getActorMunicipalityIds(claims) {
    const actorMuniIds = [];
    if (claims.municipalityId) {
        actorMuniIds.push(claims.municipalityId);
    }
    if (claims.permittedMunicipalityIds?.length) {
        actorMuniIds.push(...claims.permittedMunicipalityIds);
    }
    return actorMuniIds;
}
export function getRedispatchDeadlineMs(severity) {
    if (typeof severity === 'string' && Object.hasOwn(DEADLINE_BY_SEVERITY, severity)) {
        return DEADLINE_BY_SEVERITY[severity];
    }
    return DEADLINE_BY_SEVERITY.medium;
}
export function buildRedispatchDispatchData(input) {
    return {
        dispatchId: input.newDispatchId,
        reportId: input.reportId,
        status: 'pending',
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
    };
}
//# sourceMappingURL=redispatch-policy.js.map
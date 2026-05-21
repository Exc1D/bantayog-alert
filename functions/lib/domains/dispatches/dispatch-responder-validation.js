import { BantayogError, BantayogErrorCode, isValidReportTransition, } from '@bantayog/shared-validators';
function getActorMunicipalityIds(deps) {
    if (deps.actor.claims.municipalityId) {
        return [deps.actor.claims.municipalityId];
    }
    if (deps.actor.claims.permittedMunicipalityIds?.length) {
        return deps.actor.claims.permittedMunicipalityIds;
    }
    return [];
}
export async function assertResponderOnShift({ rtdb, municipalityId, responderUid, message = 'Responder is not on shift', }) {
    const shiftSnap = await rtdb.ref(`/responder_index/${municipalityId}/${responderUid}`).get();
    const shiftData = shiftSnap.val();
    if (shiftData?.isOnShift !== true) {
        throw new BantayogError(BantayogErrorCode.INVALID_STATUS_TRANSITION, message, {
            responderUid,
        });
    }
}
export async function validateDispatchTransaction({ tx, rtdb, deps, reportRef, responderRef, }) {
    const [reportSnap, responderSnap] = await Promise.all([tx.get(reportRef), tx.get(responderRef)]);
    const actorMuniIds = getActorMunicipalityIds(deps);
    if (actorMuniIds.length === 0) {
        throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, 'municipalityId is required');
    }
    if (!reportSnap.exists) {
        throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Report not found');
    }
    if (!responderSnap.exists) {
        throw new BantayogError(BantayogErrorCode.NOT_FOUND, 'Responder not found');
    }
    const report = reportSnap.data();
    const responder = responderSnap.data();
    if (typeof report.municipalityId !== 'string' || !report.municipalityId) {
        throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, 'Report missing municipalityId');
    }
    if (typeof responder.municipalityId !== 'string' || !responder.municipalityId) {
        throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, 'Responder missing municipalityId');
    }
    if (!actorMuniIds.includes(report.municipalityId)) {
        throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'Report not in your municipality');
    }
    if (!actorMuniIds.includes(responder.municipalityId)) {
        throw new BantayogError(BantayogErrorCode.FORBIDDEN, 'Responder not in your municipality');
    }
    if (responder.isActive !== true) {
        throw new BantayogError(BantayogErrorCode.INVALID_STATUS_TRANSITION, 'Responder is not active');
    }
    if (typeof responder.agencyId !== 'string' || !responder.agencyId) {
        throw new BantayogError(BantayogErrorCode.INVALID_ARGUMENT, 'Responder missing agencyId');
    }
    // Re-check shift status after identity + municipality checks to preserve correct error classes.
    await assertResponderOnShift({
        rtdb,
        municipalityId: responder.municipalityId,
        responderUid: deps.responderUid,
        message: 'Responder went off-shift before dispatch could be created',
    });
    const rawStatus = report.status;
    if (typeof rawStatus !== 'string') {
        throw new BantayogError(BantayogErrorCode.INVALID_STATUS_TRANSITION, 'Report status is not a string');
    }
    const to = 'assigned';
    if (rawStatus !== 'verified' || !isValidReportTransition(rawStatus, to)) {
        throw new BantayogError(BantayogErrorCode.INVALID_STATUS_TRANSITION, `Cannot dispatch from status ${rawStatus}`);
    }
    const from = 'verified';
    // After validation, we know these fields exist and have correct types.
    // Spread first so validated fields always win if keys overlap.
    const validatedResponder = {
        ...responder,
        agencyId: responder.agencyId,
        municipalityId: responder.municipalityId,
    };
    return { report, responder: validatedResponder, from };
}
//# sourceMappingURL=dispatch-responder-validation.js.map
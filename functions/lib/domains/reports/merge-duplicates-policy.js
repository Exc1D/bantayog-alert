export function hasUniqueDuplicateReportIds(duplicateReportIds) {
    return new Set(duplicateReportIds).size === duplicateReportIds.length;
}
export function excludesPrimaryReportId(primaryReportId, duplicateReportIds) {
    return !duplicateReportIds.includes(primaryReportId);
}
export function validateMergeActorClaims(claims) {
    if (claims.role !== 'municipal_admin' && claims.role !== 'provincial_superadmin') {
        return { success: false, errorCode: 'permission-denied', reason: 'role' };
    }
    if (!claims.active) {
        return { success: false, errorCode: 'permission-denied', reason: 'inactive' };
    }
    return { success: true };
}
export function validateMergeOpsRows(opsData, actorClaims) {
    const municipalityIds = opsData.map((row) => typeof row.municipalityId === 'string' ? row.municipalityId.trim() : undefined);
    const missingMunicipality = municipalityIds.some((municipalityId) => !municipalityId);
    if (missingMunicipality) {
        return { success: false, errorCode: 'failed-precondition' };
    }
    const municipalities = new Set(municipalityIds);
    if (municipalities.size !== 1) {
        return { success: false, errorCode: 'invalid-argument' };
    }
    const municipalityId = municipalityIds[0];
    if (!municipalityId) {
        return { success: false, errorCode: 'failed-precondition' };
    }
    const clusterIds = opsData
        .map((row) => typeof row.duplicateClusterId === 'string' ? row.duplicateClusterId.trim() : undefined)
        .filter((id) => typeof id === 'string' && id.length > 0);
    if (clusterIds.length !== opsData.length) {
        return { success: false, errorCode: 'failed-precondition' };
    }
    const duplicateClusterId = clusterIds[0];
    if (!duplicateClusterId || new Set(clusterIds).size !== 1) {
        return { success: false, errorCode: 'failed-precondition' };
    }
    if (actorClaims.role === 'municipal_admin' && actorClaims.municipalityId !== municipalityId) {
        return { success: false, errorCode: 'permission-denied' };
    }
    return { success: true, municipalityId, duplicateClusterId };
}
export function buildPrimaryMergeReportUpdate(primaryReportId, reportRows) {
    const mediaRefs = new Set();
    const primary = reportRows.find((row) => row.id === primaryReportId);
    addMediaRefs(mediaRefs, primary?.mediaRefs);
    for (const row of reportRows) {
        if (row.id === primaryReportId)
            continue;
        addMediaRefs(mediaRefs, row.mediaRefs);
    }
    return { mediaRefs: Array.from(mediaRefs) };
}
export function buildMergeDuplicateReportUpdate(primaryReportId) {
    return {
        status: 'merged_as_duplicate',
        mergedInto: primaryReportId,
    };
}
export function buildMergeEventData(input) {
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
    };
}
function addMediaRefs(mediaRefs, value) {
    if (!Array.isArray(value))
        return;
    for (const ref of value) {
        if (typeof ref === 'string') {
            mediaRefs.add(ref);
        }
    }
}
//# sourceMappingURL=merge-duplicates-policy.js.map
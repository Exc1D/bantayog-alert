import type { UserRole } from '@bantayog/shared-types';
export type MergeDuplicatesErrorCode = 'permission-denied' | 'not-found' | 'failed-precondition' | 'invalid-argument' | 'resource-exhausted' | 'already-exists';
export type MergePolicyResult<T extends object = object> = ({
    success: true;
} & T) | {
    success: false;
    errorCode: MergeDuplicatesErrorCode;
    reason?: 'role' | 'inactive';
};
export interface MergeActorClaims {
    role: UserRole;
    municipalityId?: string;
    active: boolean;
}
export interface MergeOpsRow {
    id: string;
    municipalityId?: unknown;
    duplicateClusterId?: unknown;
}
export interface MergeReportRow {
    id: string;
    mediaRefs?: unknown;
}
export interface BuildMergeEventDataInput {
    eventId: string;
    primaryReportId: string;
    actorUid: string;
    actorRole: UserRole;
    at: unknown;
    correlationId: string;
    duplicateReportIds: string[];
}
export declare function hasUniqueDuplicateReportIds(duplicateReportIds: string[]): boolean;
export declare function excludesPrimaryReportId(primaryReportId: string, duplicateReportIds: string[]): boolean;
export declare function validateMergeActorClaims(claims: MergeActorClaims): MergePolicyResult;
export declare function validateMergeOpsRows(opsData: MergeOpsRow[], actorClaims: Pick<MergeActorClaims, 'role' | 'municipalityId'>): MergePolicyResult<{
    municipalityId: string;
    duplicateClusterId: string;
}>;
export declare function buildPrimaryMergeReportUpdate(primaryReportId: string, reportRows: MergeReportRow[]): {
    mediaRefs: string[];
};
export declare function buildMergeDuplicateReportUpdate(primaryReportId: string): {
    status: 'merged_as_duplicate';
    mergedInto: string;
};
export declare function buildMergeEventData(input: BuildMergeEventDataInput): {
    eventId: string;
    reportId: string;
    eventType: 'merge_duplicates';
    actor: string;
    actorRole: UserRole;
    at: unknown;
    correlationId: string;
    schemaVersion: 1;
    mergedCount: number;
    mergedDuplicateIds: string[];
};
//# sourceMappingURL=merge-duplicates-policy.d.ts.map
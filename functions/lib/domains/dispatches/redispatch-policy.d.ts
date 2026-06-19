export interface RedispatchActorClaims {
    municipalityId?: string;
    permittedMunicipalityIds?: string[];
}
export interface BuildRedispatchDispatchDataInput {
    newDispatchId: string;
    reportId: string;
    newResponderUid: string;
    responderAgencyId: string;
    responderMunicipalityId: string;
    actorUid: string;
    nowMillis: number;
    deadlineMs: number;
    correlationId: string;
}
export interface RedispatchResponderData {
    agencyId?: unknown;
    municipalityId?: unknown;
    isActive?: unknown;
}
export declare function assertRedispatchTerminalStatus(status: string): void;
export declare function assertReportInActorMunicipality(actorMunicipalityIds: string[], reportMunicipalityId: unknown): void;
export declare function assertVerifiedReportStatus(status: unknown): void;
export declare function assertRedispatchResponderData(responder: RedispatchResponderData): asserts responder is {
    agencyId: string;
    municipalityId: string;
    isActive: true;
};
export declare function assertResponderInReportMunicipality(responderMunicipalityId: string, reportMunicipalityId: string): void;
export declare function getActorMunicipalityIds(claims: RedispatchActorClaims): string[];
export declare function getRedispatchDeadlineMs(severity: unknown): number;
export declare function buildRedispatchDispatchData(input: BuildRedispatchDispatchDataInput): {
    dispatchId: string;
    reportId: string;
    status: "pending";
    assignedTo: {
        uid: string;
        agencyId: string;
        municipalityId: string;
    };
    dispatchedAt: number;
    dispatchedBy: string;
    lastStatusAt: number;
    acknowledgementDeadlineAt: number;
    correlationId: string;
    schemaVersion: number;
};
//# sourceMappingURL=redispatch-policy.d.ts.map
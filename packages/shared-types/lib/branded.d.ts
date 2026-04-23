export type ReportId = string & {
    readonly __brand: 'ReportId';
};
export type DispatchId = string & {
    readonly __brand: 'DispatchId';
};
export type UserUid = string & {
    readonly __brand: 'UserUid';
};
export type AgencyId = string & {
    readonly __brand: 'AgencyId';
};
export type MunicipalityId = string & {
    readonly __brand: 'MunicipalityId';
};
export type BarangayId = string & {
    readonly __brand: 'BarangayId';
};
export type AlertId = string & {
    readonly __brand: 'AlertId';
};
export type EmergencyId = string & {
    readonly __brand: 'EmergencyId';
};
export type IncidentId = string & {
    readonly __brand: 'IncidentId';
};
export declare const asReportId: (v: string) => ReportId;
export declare const asDispatchId: (v: string) => DispatchId;
export declare const asUserUid: (v: string) => UserUid;
export declare const asAgencyId: (v: string) => AgencyId;
export declare const asMunicipalityId: (v: string) => MunicipalityId;
export declare const asBarangayId: (v: string) => BarangayId;
export declare const asAlertId: (v: string) => AlertId;
export declare const asEmergencyId: (v: string) => EmergencyId;
export declare const asIncidentId: (v: string) => IncidentId;
export type HazardZoneId = string & {
    readonly __brand: 'HazardZoneId';
};
export type HazardZoneVersion = number & {
    readonly __brand: 'HazardZoneVersion';
};
export type DispatchRequestId = string & {
    readonly __brand: 'DispatchRequestId';
};
export type CommandThreadId = string & {
    readonly __brand: 'CommandThreadId';
};
export type CommandMessageId = string & {
    readonly __brand: 'CommandMessageId';
};
export type ShiftHandoffId = string & {
    readonly __brand: 'ShiftHandoffId';
};
export type MassAlertRequestId = string & {
    readonly __brand: 'MassAlertRequestId';
};
export type MediaRef = string & {
    readonly __brand: 'MediaRef';
};
export type PublicTrackingRef = string & {
    readonly __brand: 'PublicTrackingRef';
};
export type IdempotencyKey = string & {
    readonly __brand: 'IdempotencyKey';
};
export declare const asHazardZoneId: (v: string) => HazardZoneId;
export declare const asHazardZoneVersion: (v: number) => HazardZoneVersion;
export declare const asDispatchRequestId: (v: string) => DispatchRequestId;
export declare const asCommandThreadId: (v: string) => CommandThreadId;
export declare const asCommandMessageId: (v: string) => CommandMessageId;
export declare const asShiftHandoffId: (v: string) => ShiftHandoffId;
export declare const asMassAlertRequestId: (v: string) => MassAlertRequestId;
export declare const asMediaRef: (v: string) => MediaRef;
export declare const asPublicTrackingRef: (v: string) => PublicTrackingRef;
export declare const asIdempotencyKey: (v: string) => IdempotencyKey;
//# sourceMappingURL=branded.d.ts.map
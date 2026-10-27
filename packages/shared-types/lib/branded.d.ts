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
export declare const asAgencyId: (v: string) => AgencyId;
export declare const asMunicipalityId: (v: string) => MunicipalityId;
//# sourceMappingURL=branded.d.ts.map
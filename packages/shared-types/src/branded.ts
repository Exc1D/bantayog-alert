// Branded string types — prevent mixing IDs of different entities at compile time.
// Runtime cost: zero. Compile-time benefit: entire class of "wrong ID passed" bugs eliminated.

export type ReportId = string & { readonly __brand: 'ReportId' }
export type DispatchId = string & { readonly __brand: 'DispatchId' }
export type UserUid = string & { readonly __brand: 'UserUid' }
export type AgencyId = string & { readonly __brand: 'AgencyId' }
export type MunicipalityId = string & { readonly __brand: 'MunicipalityId' }
export type BarangayId = string & { readonly __brand: 'BarangayId' }
export type AlertId = string & { readonly __brand: 'AlertId' }
export type EmergencyId = string & { readonly __brand: 'EmergencyId' }
export type IncidentId = string & { readonly __brand: 'IncidentId' }

// Cast helpers — only use at validated boundaries (after Zod parse or similar).
export const asReportId = (v: string): ReportId => v as ReportId
export const asDispatchId = (v: string): DispatchId => v as DispatchId
export const asUserUid = (v: string): UserUid => v as UserUid
export const asAgencyId = (v: string): AgencyId => v as AgencyId
export const asMunicipalityId = (v: string): MunicipalityId => v as MunicipalityId
export const asBarangayId = (v: string): BarangayId => v as BarangayId
export const asAlertId = (v: string): AlertId => v as AlertId
export const asEmergencyId = (v: string): EmergencyId => v as EmergencyId
export const asIncidentId = (v: string): IncidentId => v as IncidentId

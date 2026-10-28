// Branded string types — prevent mixing IDs of different entities at compile time.
// Runtime cost: zero. Compile-time benefit: entire class of "wrong ID passed" bugs eliminated.

export type UserUid = string & { readonly __brand: 'UserUid' }
export type AgencyId = string & { readonly __brand: 'AgencyId' }
export type MunicipalityId = string & { readonly __brand: 'MunicipalityId' }
export type BarangayId = string & { readonly __brand: 'BarangayId' }

export const asAgencyId = (v: string): AgencyId => v as AgencyId
export const asMunicipalityId = (v: string): MunicipalityId => v as MunicipalityId

import { query, where, type Query } from 'firebase/firestore'

// Role scoping shared by the admin Firestore listener hooks.
const ALLOWED_ROLES = new Set(['provincial_superadmin', 'municipal_admin', 'agency_admin'])

export function isAuthorized(
  role: string | null,
  municipalityId: string | null,
  agencyId: string | null,
): boolean {
  if (!ALLOWED_ROLES.has(role ?? '')) return false
  if (role === 'municipal_admin' && !municipalityId) return false
  if (role === 'agency_admin' && !agencyId) return false
  return true
}

interface ScopeFields {
  municipal: string
  agency: string
  agencyOperator?: '==' | 'array-contains'
}

export function scopeQuery(
  base: Query,
  role: string | null,
  municipalityId: string | null,
  agencyId: string | null,
  fields: ScopeFields = { municipal: 'municipalityId', agency: 'agencyId' },
): Query {
  if (role === 'municipal_admin' && municipalityId) {
    return query(base, where(fields.municipal, '==', municipalityId))
  }
  if (role === 'agency_admin' && agencyId) {
    return query(base, where(fields.agency, fields.agencyOperator ?? '==', agencyId))
  }
  return base
}

export function snapshotError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

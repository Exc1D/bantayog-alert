/**
 * Centralized role definitions to prevent role-drift across callables.
 *
 * All privileged callables should reference these constants instead of
 * hard-coding role strings.  Changing a role name here automatically
 * updates every gate that uses it.
 */

/** Roles that grant full province-wide administrative authority. */
export const PROVINCIAL_SUPERADMIN = 'provincial_superadmin' as const

/** PDRRMO role — provincial disaster-response officer. */
export const PDRRMO = 'pdrrmo' as const

/** Convenience array for requireAuth() calls that accept only superadmin. */
export const PRIVILEGED_ROLES: string[] = [PROVINCIAL_SUPERADMIN]

/** Convenience array for requireAuth() calls that accept superadmin + PDRRMO. */
export const PRIVILEGED_WITH_PDRRMO: string[] = [PROVINCIAL_SUPERADMIN, PDRRMO]

import type { Role } from '@bantayog/shared-types'

const PRIVILEGED_ROLES: ReadonlySet<Role> = new Set([
  'responder',
  'municipal_admin',
  'agency_admin',
  'provincial_superadmin',
])

export function isPrivilegedRole(role: Role): boolean {
  return PRIVILEGED_ROLES.has(role)
}

/** §4.6 — Session re-auth intervals, in milliseconds */
const SESSION_TIMEOUTS: Record<Role, number> = {
  citizen: Infinity,
  responder: 12 * 60 * 60 * 1000,
  municipal_admin: 8 * 60 * 60 * 1000,
  agency_admin: 8 * 60 * 60 * 1000,
  provincial_superadmin: 4 * 60 * 60 * 1000,
}

export function sessionTimeoutMs(role: Role): number {
  return SESSION_TIMEOUTS[role]
}

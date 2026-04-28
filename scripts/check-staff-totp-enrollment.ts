/**
 * Staff TOTP enrollment audit
 *
 * Verifies that staff test accounts in staging have enrolled at least one MFA factor.
 * This script only audits Auth state; it does not enroll users.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json pnpm exec tsx scripts/check-staff-totp-enrollment.ts
 */

import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const PROJECT_ID = 'bantayog-alert-staging'
const TEST_EMAIL_SUFFIX = '@test.local'
const PAGE_SIZE = 1000

const STAFF_ROLES = new Set([
  'municipal_admin',
  'agency_admin',
  'provincial_superadmin',
  'responder',
])

if (getApps().length === 0) {
  initializeApp({ projectId: PROJECT_ID })
}

const auth = getAuth()

type AuthUser = Awaited<ReturnType<typeof auth.listUsers>>['users'][number]
type StaffRole = (typeof STAFF_ROLES extends Set<infer Role> ? Role : never) & string

function getRole(user: AuthUser): StaffRole | undefined {
  const role = user.customClaims?.role
  if (typeof role !== 'string' || !STAFF_ROLES.has(role as StaffRole)) return undefined
  return role as StaffRole
}

function isStaffTestAccount(user: AuthUser): boolean {
  const email = user.email
  if (typeof email !== 'string' || !email.endsWith(TEST_EMAIL_SUFFIX)) return false
  return getRole(user) !== undefined
}

function hasTotpEnrollment(user: AuthUser): boolean {
  return (user.multiFactor?.enrolledFactors?.length ?? 0) > 0
}

async function listAllUsers(): Promise<AuthUser[]> {
  const users: AuthUser[] = []
  let pageToken: string | undefined

  do {
    const page = await auth.listUsers(PAGE_SIZE, pageToken)
    users.push(...page.users)
    pageToken = page.pageToken
  } while (pageToken)

  return users
}

function formatUser(user: AuthUser): string {
  const role = getRole(user) ?? 'unknown'
  const enrolled = hasTotpEnrollment(user) ? 'enrolled' : 'missing'
  return `${user.uid} <${user.email ?? 'no-email'}> role=${role} mfa=${enrolled}`
}

async function main(): Promise<void> {
  const allUsers = await listAllUsers()
  const staffUsers = allUsers.filter(isStaffTestAccount)

  if (staffUsers.length === 0) {
    throw new Error(
      `No staff test accounts found in ${PROJECT_ID}. Check that staging test users exist and have staff roles.`,
    )
  }

  const unenrolledUsers = staffUsers.filter((user) => !hasTotpEnrollment(user))

  console.log(`Audited ${staffUsers.length} staff test account(s) in ${PROJECT_ID}.`)
  for (const user of staffUsers) {
    console.log(`- ${formatUser(user)}`)
  }

  if (unenrolledUsers.length > 0) {
    console.error('\nUnenrolled staff test accounts:')
    for (const user of unenrolledUsers) {
      console.error(`- ${formatUser(user)}`)
    }
    throw new Error('Staff TOTP enrollment incomplete')
  }

  console.log('\nAll staff test accounts have TOTP enrollment.')
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  if (/credential|default credentials|service account|permission denied/i.test(message)) {
    console.error(
      'Unable to query Firebase Auth. Set GOOGLE_APPLICATION_CREDENTIALS to a staging service-account key, or run in an environment with default Firebase credentials.',
    )
  }
  console.error(message)
  process.exit(1)
})

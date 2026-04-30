#!/usr/bin/env tsx
/**
 * Idempotent staff provisioning for the Bantayog Alert pilot.
 * Creates Firebase Auth accounts, sets custom claims, writes active_accounts docs,
 * and generates password-reset links (links are logged to stdout).
 *
 * Usage:
 *   npx tsx scripts/provision-pilot-staff.ts \
 *     --project bantayog-alert \
 *     --input scripts/pilot-staff-manifest.csv
 *
 * Requires: GOOGLE_APPLICATION_CREDENTIALS or ADC with Firebase Admin rights.
 */
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const args = process.argv.slice(2)
const projectIdx = args.indexOf('--project')
const inputIdx = args.indexOf('--input')

const project = projectIdx >= 0 ? (args[projectIdx + 1] ?? 'bantayog-alert') : 'bantayog-alert'
const csvPath =
  inputIdx >= 0
    ? (args[inputIdx + 1] ?? 'scripts/pilot-staff-manifest.csv')
    : 'scripts/pilot-staff-manifest.csv'

if (getApps().length === 0) {
  initializeApp({ projectId: project })
}

const adminAuth = getAuth()
const adminDb = getFirestore()

type StaffRole = 'municipal_admin' | 'agency_admin' | 'provincial_superadmin' | 'responder'

const VALID_ROLES: StaffRole[] = [
  'municipal_admin',
  'agency_admin',
  'provincial_superadmin',
  'responder',
]

interface StaffRow {
  email: string
  role: StaffRole
  municipalityId: string
  agencyId: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function assertStaffRole(value: string): StaffRole {
  if (!VALID_ROLES.includes(value as StaffRole)) {
    throw new Error(`Invalid role "${value}". Expected one of: ${VALID_ROLES.join(', ')}`)
  }
  return value as StaffRole
}

async function readCsv(path: string): Promise<StaffRow[]> {
  const rows: StaffRow[] = []
  let headers: string[] = []
  const rl = createInterface({ input: createReadStream(path) })
  let isFirst = true

  for await (const line of rl) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const cols = trimmed.split(',').map((s) => s.trim())
    if (isFirst) {
      headers = cols
      const required = ['email', 'role']
      for (const h of required) {
        if (!headers.includes(h)) {
          throw new Error(`CSV missing required header: "${h}". Found: ${headers.join(', ')}`)
        }
      }
      isFirst = false
      continue
    }
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? ''
    })
    const email = row['email'] ?? ''
    const roleRaw = row['role'] ?? 'responder'
    if (!EMAIL_RE.test(email)) {
      throw new Error(`Invalid email "${email}" in row: ${JSON.stringify(row)}`)
    }
    rows.push({
      email,
      role: assertStaffRole(roleRaw),
      municipalityId: row['municipalityId'] ?? '',
      agencyId: row['agencyId'] ?? '',
    })
  }

  return rows
}

type RowResult = {
  email: string
  status: 'created' | 'existed' | 'failed'
  uid?: string
  error?: string
}

async function provisionRow(row: StaffRow): Promise<RowResult> {
  const { email, role, municipalityId, agencyId } = row

  let uid: string
  let status: RowResult['status']

  try {
    const existing = await adminAuth.getUserByEmail(email).catch(() => null)

    if (existing) {
      uid = existing.uid
      status = 'existed'
    } else {
      const created = await adminAuth.createUser({ email, emailVerified: false })
      uid = created.uid
      status = 'created'
    }

    const issuedAt = Date.now()
    const claims: Record<string, unknown> = {
      role,
      accountStatus: 'active',
      mfaEnrolled: false,
      lastClaimIssuedAt: issuedAt,
      permittedMunicipalityIds: municipalityId ? [municipalityId] : [],
    }
    if (municipalityId) claims['municipalityId'] = municipalityId
    if (agencyId) claims['agencyId'] = agencyId

    await adminAuth.setCustomUserClaims(uid, claims)

    await adminDb
      .collection('active_accounts')
      .doc(uid)
      .set(
        {
          uid,
          role,
          accountStatus: 'active',
          municipalityId: municipalityId || null,
          agencyId: agencyId || null,
          permittedMunicipalityIds: municipalityId ? [municipalityId] : [],
          mfaEnrolled: false,
          lastClaimIssuedAt: issuedAt,
          updatedAt: Timestamp.now(),
        },
        { merge: true },
      )

    const resetLink = await adminAuth.generatePasswordResetLink(email)
    console.log(`[INFO] Reset link for ${email}: ${resetLink}`)

    return { email, status, uid }
  } catch (err) {
    return { email, status: 'failed', error: String(err) }
  }
}

async function main(): Promise<void> {
  console.log(`Provisioning staff from ${csvPath} into ${project}...\n`)

  const rows = await readCsv(csvPath)
  if (rows.length === 0) {
    console.error('No rows found in CSV. Check file format and that the file exists.')
    process.exit(1)
  }

  const results: RowResult[] = []
  for (const row of rows) {
    const result = await provisionRow(row)
    results.push(result)
    const icon = result.status === 'failed' ? 'FAIL' : 'ok'
    const detail = result.error
      ? ` — ${result.error}`
      : ` (uid: ${result.uid ?? 'n/a'}, ${result.status})`
    console.log(`[${icon}] ${result.email}${detail}`)
  }

  const failed = results.filter((r) => r.status === 'failed')
  if (failed.length > 0) {
    console.error(
      `\n${failed.length} account(s) failed. Fix errors and re-run (script is idempotent).`,
    )
    process.exit(1)
  }

  console.log(
    `\n${results.length} account(s) provisioned. Password reset links logged above — distribute securely to staff.`,
  )
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})

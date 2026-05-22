import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID ?? 'bantayog-alert-dev'

process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099'
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8081'

const app = getApps()[0] ?? initializeApp({ projectId: PROJECT_ID })
const auth = getAuth(app)
const db = getFirestore(app)

function isUserNotFoundError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.message.includes('auth/user-not-found') ||
      err.message.includes('user not found') ||
      err.message.includes('There is no user record corresponding to the provided identifier'))
  )
}

async function getUserByEmailOrNull(email: string) {
  return auth.getUserByEmail(email).catch((err: unknown) => {
    if (isUserNotFoundError(err)) return null
    throw err
  })
}

async function ensureUser(opts: {
  uid: string
  email: string
  password: string
  claims: Record<string, unknown>
  activeAccount: Record<string, unknown>
}) {
  const user = await getUserByEmailOrNull(opts.email)
  if (user) {
    await auth.updateUser(user.uid, { password: opts.password })
  } else {
    await auth.createUser({ uid: opts.uid, email: opts.email, password: opts.password })
  }
  await auth.setCustomUserClaims(opts.uid, opts.claims)
  await db
    .collection('active_accounts')
    .doc(opts.uid)
    .set({
      ...opts.activeAccount,
      updatedAt: Date.now(),
      lastClaimIssuedAt: Date.now(),
    })
  return { email: opts.email, password: opts.password, uid: opts.uid }
}

export async function ensureMunicipalAdmin() {
  return ensureUser({
    uid: 'muni-admin-daet',
    email: 'muni-admin-daet@test.local',
    password: 'test123456',
    claims: {
      role: 'municipal_admin',
      accountStatus: 'active',
      municipalityId: 'daet',
    },
    activeAccount: {
      uid: 'muni-admin-daet',
      role: 'municipal_admin',
      accountStatus: 'active',
      municipalityId: 'daet',
      permittedMunicipalityIds: [],
      mfaEnrolled: true,
    },
  })
}

export async function ensureProvincialSuperadmin() {
  return ensureUser({
    uid: 'provincial-superadmin',
    email: 'provincial-superadmin@test.local',
    password: 'test123456',
    claims: {
      role: 'provincial_superadmin',
      accountStatus: 'active',
    },
    activeAccount: {
      uid: 'provincial-superadmin',
      role: 'provincial_superadmin',
      accountStatus: 'active',
      municipalityId: null,
      permittedMunicipalityIds: [
        'daet',
        'mercedes',
        'basud',
        'capalonga',
        'jose-panganiban',
        'labo',
        'paracale',
        'san-lorenzo-ruiz',
        'san-vicente',
        'santa-elena',
        'talibay',
        'vinzons',
      ],
      mfaEnrolled: true,
    },
  })
}

export async function ensureAgencyAdmin() {
  return ensureUser({
    uid: 'agency-admin-bfp-daet',
    email: 'agency-admin-bfp-daet@test.local',
    password: 'test123456',
    claims: {
      role: 'agency_admin',
      accountStatus: 'active',
      agencyId: 'bfp-daet',
      municipalityId: 'daet',
    },
    activeAccount: {
      uid: 'agency-admin-bfp-daet',
      role: 'agency_admin',
      accountStatus: 'active',
      agencyId: 'bfp-daet',
      municipalityId: 'daet',
      permittedMunicipalityIds: [],
      mfaEnrolled: true,
    },
  })
}

export async function seedAdminAccounts() {
  await ensureMunicipalAdmin()
  await ensureProvincialSuperadmin()
  await ensureAgencyAdmin()
}

// Auto-seed when run directly via `npx tsx fixtures/admin-seed.ts`
if (process.argv[1] === new URL(import.meta.url).pathname) {
  seedAdminAccounts()
    .then(() => {
      console.log('Admin accounts seeded')
    })
    .catch((err: unknown) => {
      console.error('Seed failed:', err)
      process.exit(1)
    })
}

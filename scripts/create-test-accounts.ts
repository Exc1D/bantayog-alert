import { initializeApp, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getDatabase } from 'firebase-admin/database'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8081'
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9000'

const PROJECT_ID = 'bantayog-alert-staging'

if (getApps().length === 0) {
  initializeApp({ projectId: PROJECT_ID, databaseURL: `http://127.0.0.1:9000?ns=${PROJECT_ID}` })
}

const auth = getAuth()
const db = getFirestore()

interface CustomClaims {
  role: string
  municipalityId?: string
  agencyId?: string
  accountStatus: string
  active: boolean
  permittedMunicipalityIds: string[]
}

function isFirebaseAuthError(err: unknown): err is { code: string; message: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as { code: unknown }).code === 'string' &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string'
  )
}

async function createAccount(uid: string, email: string, password: string, claims?: CustomClaims) {
  try {
    await auth.createUser({
      uid,
      email,
      password,
    })
    console.log(`✓ Created ${uid}`)

    if (claims) {
      await auth.setCustomUserClaims(uid, claims)
      console.log(`✓ Set claims for ${uid}`)
    }

    return true
  } catch (err: unknown) {
    if (isFirebaseAuthError(err) && err.code === 'auth/uid-already-exists') {
      console.log(`✓ ${uid} already exists`)
      if (claims) {
        await auth.setCustomUserClaims(uid, claims)
        console.log(`✓ Updated claims for ${uid}`)
      }
      return true
    }
    const message = isFirebaseAuthError(err) ? err.message : String(err)
    console.error(`✗ Failed to create ${uid}:`, message)
    return false
  }
}

async function main() {
  console.log('Creating test accounts...\n')

  // Citizen account
  const createdCitizen = await createAccount(
    'citizen-test-01',
    'citizen-test-01@test.local',
    'test123456',
  )
  if (!createdCitizen) throw new Error('Failed to provision citizen-test-01')

  // Admin account
  const createdAdmin = await createAccount(
    'daet-admin-test-01',
    'daet-admin-test-01@test.local',
    'test123456',
    {
      role: 'municipal_admin',
      municipalityId: 'daet',
      accountStatus: 'active',
      active: true,
      permittedMunicipalityIds: ['daet'],
    },
  )
  if (!createdAdmin) throw new Error('Failed to provision daet-admin-test-01')

  // Provincial superadmin account
  const createdSuperadmin = await createAccount(
    'superadmin-test-01',
    'superadmin@test.local',
    'test123456',
    {
      role: 'provincial_superadmin',
      accountStatus: 'active',
      active: true,
      permittedMunicipalityIds: [],
    },
  )
  if (!createdSuperadmin) {
    throw new Error('Failed to provision superadmin-test-01')
  }

  // Responder account
  const createdResponder = await createAccount(
    'bfp-responder-test-01',
    'bfp-responder-test-01@test.local',
    'test123456',
    {
      role: 'responder',
      municipalityId: 'daet',
      agencyId: 'bfp-daet',
      accountStatus: 'active',
      active: true,
      permittedMunicipalityIds: ['daet'],
    },
  )
  if (!createdResponder) {
    throw new Error('Failed to provision bfp-responder-test-01')
  }

  console.log('\n✓ Done! Test accounts ready.')
}

async function seedActiveAccounts(db: ReturnType<typeof getFirestore>) {
  const now = Date.now()
  const ts = Timestamp.fromMillis(now)

  const accounts = [
    {
      uid: 'daet-admin-test-01',
      role: 'municipal_admin',
      accountStatus: 'active',
      municipalityId: 'daet',
      agencyId: null,
      permittedMunicipalityIds: ['daet'],
      mfaEnrolled: false,
      lastClaimIssuedAt: ts,
      updatedAt: ts,
    },
    {
      uid: 'superadmin-test-01',
      role: 'provincial_superadmin',
      accountStatus: 'active',
      municipalityId: null,
      agencyId: null,
      permittedMunicipalityIds: [],
      mfaEnrolled: false,
      lastClaimIssuedAt: ts,
      updatedAt: ts,
    },
    {
      uid: 'bfp-responder-test-01',
      role: 'responder',
      accountStatus: 'active',
      municipalityId: 'daet',
      agencyId: 'bfp-daet',
      permittedMunicipalityIds: ['daet'],
      mfaEnrolled: false,
      lastClaimIssuedAt: ts,
      updatedAt: ts,
    },
  ]

  for (const acc of accounts) {
    await db.collection('active_accounts').doc(acc.uid).set(acc)
    console.log(`✓ active_accounts/${acc.uid}`)
  }
}

async function seedResponderRoster(
  db: ReturnType<typeof getFirestore>,
  rtdb: ReturnType<typeof getDatabase>,
) {
  const uid = 'bfp-responder-test-01'
  await db.collection('responders').doc(uid).set({
    uid,
    displayName: 'BFP Daet Test Responder',
    agency: 'BFP',
    agencyId: 'BFP',
    municipalityId: 'daet',
    isActive: true,
    availabilityStatus: 'available',
    updatedAt: Timestamp.now(),
  })
  await rtdb.ref('responder_index/bfp-responder-test-01').set({
    municipalityId: 'daet',
    agencyId: 'BFP',
  })
  await rtdb.ref('responder_index/daet/bfp-responder-test-01').set({
    isOnShift: true,
    agencyId: 'BFP',
  })
  await rtdb.ref('responder_locations/bfp-responder-test-01').set({
    uid,
    displayName: 'BFP Daet Test Responder',
    agency: 'BFP',
  })
  console.log(`✓ responders/${uid} roster metadata`)
}

main()
  .then(async () => {
    const db = getFirestore()
    const rtdb = getDatabase()
    try {
      await seedActiveAccounts(db)
      await seedResponderRoster(db, rtdb)
    } finally {
      rtdb.goOffline()
    }
    console.log('\n✓ Done! Test accounts and active_accounts seeded.')
  })
  .catch((err: unknown) => {
    console.error(err)
    process.exit(1)
  })

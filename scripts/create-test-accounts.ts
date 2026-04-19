import { initializeApp, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099'

const PROJECT_ID = 'bantayog-alert-dev'

if (getApps().length === 0) {
  initializeApp({ projectId: PROJECT_ID })
}

const auth = getAuth()
const db = getFirestore()

async function createAccount(
  uid: string,
  email: string,
  password: string,
  claims?: Record<string, any>,
) {
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
  } catch (err: any) {
    if (err.code === 'auth/uid-already-exists') {
      console.log(`✓ ${uid} already exists`)
      if (claims) {
        await auth.setCustomUserClaims(uid, claims)
        console.log(`✓ Updated claims for ${uid}`)
      }
      return true
    }
    console.error(`✗ Failed to create ${uid}:`, err.message)
    return false
  }
}

async function main() {
  console.log('Creating test accounts...\n')

  // Citizen account
  await createAccount('citizen-test-01', 'citizen-test-01@test.local', 'test123456')

  // Admin account
  await createAccount('daet-admin-test-01', 'daet-admin-test-01@test.local', 'test123456', {
    role: 'municipal_admin',
    municipalityId: 'daet',
    active: true,
  })

  console.log('\n✓ Done! Test accounts ready.')
}

main().catch(console.error)

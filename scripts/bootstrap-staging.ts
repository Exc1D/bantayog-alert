/**
 * Staging Environment Bootstrap
 *
 * Creates all test accounts, responder documents, and feature flags
 * needed for Phase 3b/3c testing in the staging environment.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json pnpm exec tsx scripts/bootstrap-staging.ts
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const PROJECT_ID = 'bantayog-alert-staging'

if (getApps().length === 0) {
  initializeApp({ projectId: PROJECT_ID })
}

const auth = getAuth()
const db = getFirestore()

async function main() {
  console.log('🚀 Bootstrapping staging environment...\n')

  // 1. Create citizen-test-01
  console.log('Creating citizen-test-01...')
  try {
    await auth.createUser({
      uid: 'citizen-test-01',
      email: 'citizen-test-01@test.local',
      password: 'test123456',
    })
    console.log('✓ citizen-test-01 created')
  } catch (err: any) {
    if (err.code === 'auth/uid-already-exists') {
      console.log('✓ citizen-test-01 already exists')
    } else {
      console.error('✗ Failed to create citizen-test-01:', err.message)
    }
  }

  // 2. Create daet-admin-test-01 with claims
  console.log('\nCreating daet-admin-test-01 with municipal_admin claims...')
  try {
    await auth.createUser({
      uid: 'daet-admin-test-01',
      email: 'daet-admin-test-01@test.local',
      password: 'test123456',
    })
    console.log('✓ daet-admin-test-01 created')
  } catch (err: any) {
    if (err.code === 'auth/uid-already-exists') {
      console.log('✓ daet-admin-test-01 already exists')
    } else {
      console.error('✗ Failed to create daet-admin-test-01:', err.message)
    }
  }

  // Set custom claims for admin
  try {
    await auth.setCustomUserClaims('daet-admin-test-01', {
      role: 'municipal_admin',
      municipalityId: 'daet',
      active: true,
    })
    console.log('✓ daet-admin-test-01 custom claims set')
  } catch (err: any) {
    console.error('✗ Failed to set admin claims:', err.message)
  }

  // 3. Create bfp-responder-test-01 with claims
  console.log('\nCreating bfp-responder-test-01 with responder claims...')
  try {
    await auth.createUser({
      uid: 'bfp-responder-test-01',
      email: 'bfp-responder-test-01@test.local',
      password: 'test123456',
    })
    console.log('✓ bfp-responder-test-01 created')
  } catch (err: any) {
    if (err.code === 'auth/uid-already-exists') {
      console.log('✓ bfp-responder-test-01 already exists')
    } else {
      console.error('✗ Failed to create bfp-responder-test-01:', err.message)
    }
  }

  // Set custom claims for responder
  try {
    await auth.setCustomUserClaims('bfp-responder-test-01', {
      role: 'responder',
      municipalityId: 'daet',
      agencyId: 'bfp-daet',
      active: true,
    })
    console.log('✓ bfp-responder-test-01 custom claims set')
  } catch (err: any) {
    console.error('✗ Failed to set responder claims:', err.message)
  }

  // 4. Create responder document
  console.log('\nCreating responder document...')
  try {
    await db.collection('responders').doc('bfp-responder-test-01').set({
      isActive: true,
      fcmTokens: [],
      municipalityId: 'daet',
      agencyId: 'bfp-daet',
    })
    console.log('✓ bfp-responder-test-01 document created')
  } catch (err: any) {
    console.error('✗ Failed to create responder document:', err.message)
  }

  // 5. Create feature flag
  console.log('\nCreating feature flag...')
  try {
    const featuresRef = db.collection('system_config').doc('features')
    const featuresDoc = await featuresRef.get()

    const data = {
      dispatch_mirror_enabled: true,
      updatedAt: new Date(),
    }

    if (!featuresDoc.exists) {
      await featuresRef.set(data)
      console.log('✓ system_config/features document created')
    } else {
      await featuresRef.update(data)
      console.log('✓ dispatch_mirror_enabled flag set')
    }
  } catch (err: any) {
    console.error('✗ Failed to set feature flag:', err.message)
  }

  console.log('\n✅ Staging bootstrap complete!')
  console.log('\n📋 Summary:')
  console.log('  • citizen-test-01: Citizen account')
  console.log('  • daet-admin-test-01: Municipal admin (Daet)')
  console.log('  • bfp-responder-test-01: BFP responder (Daet)')
  console.log('  • dispatch_mirror_enabled: true')
  console.log('\n🔐 Test Credentials:')
  console.log('  Email: [user]-test-01@test.local')
  console.log('  Password: test123456')
  console.log('\n📍 Staging URLs:')
  console.log(
    '  Firebase Console: https://console.firebase.google.com/project/bantayog-alert-staging',
  )
  console.log(
    '  Firestore: https://console.firebase.google.com/project/bantayog-alert-staging/firestore/data',
  )
}

main().catch((err) => {
  console.error('\n❌ Bootstrap failed:', err)
  process.exit(1)
})

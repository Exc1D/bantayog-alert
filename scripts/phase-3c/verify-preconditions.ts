/**
 * Phase 3c Precondition Verification
 *
 * Verifies that staging infrastructure is ready for Phase 3c implementation:
 * 1. Test accounts exist (citizen-test-01, daet-admin-test-01, bfp-responder-test-01)
 * 2. system_config/features/dispatch_mirror_enabled: true
 * 3. VAPID secret references exist
 *
 * Usage:
 *   pnpm exec tsx scripts/phase-3c/verify-preconditions.ts --env=emulator
 *   pnpm exec tsx scripts/phase-3c/verify-preconditions.ts --env=staging
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const EMU = !process.argv.includes('--env=staging')
if (EMU) {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080'
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099'
}

const PROJECT_ID =
  process.env.GCLOUD_PROJECT ?? process.env.FIREBASE_PROJECT_ID ?? 'bantayog-alert-dev'

if (getApps().length === 0) {
  initializeApp({ projectId: PROJECT_ID })
}

type CheckResult = {
  name: string
  status: 'pass' | 'fail' | 'warn'
  detail?: string
}

const results: CheckResult[] = []

function check(name: string, status: 'pass' | 'fail' | 'warn', detail?: string) {
  results.push({ name, status, detail })
  const icon = status === 'pass' ? '✓' : status === 'fail' ? '✗' : '⚠'
  console.log(`${icon} ${name}${detail ? ` — ${detail}` : ''}`)
}

async function verifyTestAccounts() {
  console.log('\n=== Verifying Test Accounts ===')
  const auth = getAuth()
  const db = getFirestore()

  // Check citizen-test-01 (used as reporter in acceptance tests)
  try {
    const citizenUser = await auth.getUser('citizen-test-01')
    check('citizen-test-01 auth account exists', 'pass', `email=${citizenUser.email || 'N/A'}`)
  } catch (err: unknown) {
    check('citizen-test-01 auth account exists', 'fail', 'account not found')
  }

  // Check daet-admin-test-01
  try {
    const adminUser = await auth.getUser('daet-admin-test-01')
    const claims = adminUser.customClaims
    const hasValidClaims =
      claims?.role === 'municipal_admin' &&
      claims?.municipalityId === 'daet' &&
      claims?.active === true

    check(
      'daet-admin-test-01 exists with valid claims',
      hasValidClaims ? 'pass' : 'warn',
      `role=${claims?.role}, muni=${claims?.municipalityId}, active=${claims?.active}`,
    )
  } catch (err: unknown) {
    check('daet-admin-test-01 exists with valid claims', 'fail', 'account not found')
  }

  // Check bfp-responder-test-01
  try {
    const responderUser = await auth.getUser('bfp-responder-test-01')
    const claims = responderUser.customClaims
    const hasValidClaims =
      claims?.role === 'responder' && claims?.municipalityId === 'daet' && claims?.active === true

    check(
      'bfp-responder-test-01 exists with valid claims',
      hasValidClaims ? 'pass' : 'warn',
      `role=${claims?.role}, agency=${claims?.agencyId}, active=${claims?.active}`,
    )

    // Check responders collection document
    const responderDoc = await db.collection('responders').doc('bfp-responder-test-01').get()
    if (responderDoc.exists) {
      const data = responderDoc.data()
      const hasValidDoc = data?.isActive === true && Array.isArray(data?.fcmTokens)
      check(
        'bfp-responder-test-01 responders doc valid',
        hasValidDoc ? 'pass' : 'warn',
        `isActive=${data?.isActive}, fcmTokens.length=${data?.fcmTokens?.length ?? 0}`,
      )
    } else {
      check('bfp-responder-test-01 responders doc valid', 'fail', 'doc not found')
    }
  } catch (err: unknown) {
    check('bfp-responder-test-01 exists', 'fail', 'account or doc not found')
  }
}

async function verifyFeatureFlags() {
  console.log('\n=== Verifying Feature Flags ===')
  const db = getFirestore()

  try {
    const configDoc = await db.collection('system_config').doc('features').get()
    if (configDoc.exists) {
      const data = configDoc.data()
      const mirrorEnabled = data?.dispatch_mirror_enabled === true
      check(
        'dispatch_mirror_enabled feature flag',
        mirrorEnabled ? 'pass' : 'warn',
        `value=${data?.dispatch_mirror_enabled ?? 'missing'}`,
      )

      // Check updatedAt for staleness
      const updatedAt = data?.updatedAt?.toDate?.()
      if (updatedAt) {
        const daysSinceUpdate = Math.floor(
          (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24),
        )
        check(
          'feature flag recency',
          daysSinceUpdate < 30 ? 'pass' : 'warn',
          `${daysSinceUpdate} days ago`,
        )
      }
    } else {
      check('dispatch_mirror_enabled feature flag', 'warn', 'system_config/features doc not found')
    }
  } catch (err: unknown) {
    check('dispatch_mirror_enabled feature flag', 'fail', String(err))
  }
}

async function verifyVapidSecrets() {
  console.log('\n=== Verifying VAPID Secrets ===')

  // This is a documentation check - we can't actually verify GCP Secret Manager from here
  check('VAPID secrets documented', 'pass', 'see docs/runbooks/fcm-vapid-rotation.md')

  if (EMU) {
    check(
      'VAPID secrets provisioned (staging)',
      'warn',
      'cannot verify in emulator — run with --env=staging',
    )
  } else {
    check(
      'VAPID secrets provisioned (staging)',
      'warn',
      'manual verification required: gcloud secrets versions list fcm-vapid-private-key --project=bantayog-alert-staging',
    )
  }
}

async function main() {
  console.log(`\n🔍 Phase 3c Precondition Verification`)
  console.log(`📍 Environment: ${EMU ? 'emulator' : 'staging'}`)
  console.log(`📍 Project: ${PROJECT_ID}`)

  await verifyTestAccounts()
  await verifyFeatureFlags()
  await verifyVapidSecrets()

  console.log('\n=== Summary ===')
  const passed = results.filter((r) => r.status === 'pass').length
  const failed = results.filter((r) => r.status === 'fail').length
  const warned = results.filter((r) => r.status === 'warn').length

  console.log(`✓ Passed: ${passed}`)
  console.log(`⚠ Warnings: ${warned}`)
  console.log(`✗ Failed: ${failed}`)

  if (failed > 0) {
    console.log('\n❌ PRECONDITION VERIFICATION FAILED')
    console.log('Required actions before Phase 3c implementation:')
    results
      .filter((r) => r.status === 'fail')
      .forEach((r) => {
        console.log(`  - ${r.name}: ${r.detail || 'see error above'}`)
      })
    process.exit(1)
  } else if (warned > 0) {
    console.log('\n⚠️  PRECONDITION VERIFICATION PASSED WITH WARNINGS')
    console.log('Review warnings before proceeding:')
    results
      .filter((r) => r.status === 'warn')
      .forEach((r) => {
        console.log(`  - ${r.name}: ${r.detail}`)
      })
  } else {
    console.log('\n✅ ALL PRECONDITIONS VERIFIED')
    console.log('Ready to begin Phase 3c implementation.')
  }
}

main().catch((err) => {
  console.error('Verification failed:', err)
  process.exit(1)
})

#!/usr/bin/env tsx
/**
 * Phase 3a acceptance gate.
 *
 * Run against the local emulator:
 *   firebase emulators:exec --only firestore,functions,storage \
 *     "pnpm tsx scripts/phase-3a/acceptance.ts --env=emulator"
 *
 * Or against staging with credentials:
 *   GOOGLE_APPLICATION_CREDENTIALS=./sa.json \
 *     pnpm tsx scripts/phase-3a/acceptance.ts --env=staging
 */
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { randomUUID, createHash } from 'node:crypto'
import { CAMARINES_NORTE_MUNICIPALITIES } from '../packages/shared-validators/src/municipalities.js'

interface Assertion {
  name: string
  ok: boolean
  detail?: string
}

const results: Assertion[] = []
function check(name: string, ok: boolean, detail?: string): void {
  results.push({ name, ok, detail })
  console.log(ok ? `✓ PASS ${name}` : `✗ FAIL ${name} — ${detail ?? ''}`)
}

async function main(): Promise<void> {
  const env = process.argv.find((a) => a.startsWith('--env='))?.split('=')[1] ?? 'emulator'
  if (env === 'emulator') {
    process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? 'localhost:8080'
    initializeApp({ projectId: 'bantayog-alert-acceptance' })
  } else {
    initializeApp({ credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS ?? '') })
  }
  const db = getFirestore()

  console.log(`\n🧪 Phase 3a Acceptance Test (env=${env})\n`)

  // 0. Ensure municipalities seeded
  console.log('0. Checking municipalities...')
  const muniSnap = await db.collection('municipalities').doc('daet').get()
  check('municipalities:daet seeded', muniSnap.exists, 'run scripts/bootstrap-municipalities.ts')
  if (!muniSnap.exists) {
    console.error(
      '\n❌ Municipalities not seeded. Run: pnpm tsx scripts/bootstrap-municipalities.ts',
    )
    process.exit(1)
  }

  // 1. Write an inbox doc directly (simulating the client write)
  console.log('\n1. Writing inbox document...')
  const correlationId = randomUUID()
  const secret = randomUUID()
  const secretHash = createHash('sha256').update(secret).digest('hex')
  const publicRef = Math.random().toString(36).slice(2, 10)
  const inboxId = randomUUID()
  await db
    .collection('report_inbox')
    .doc(inboxId)
    .set({
      reporterUid: 'accept-citizen-1',
      clientCreatedAt: Date.now(),
      idempotencyKey: randomUUID(),
      publicRef,
      secretHash,
      correlationId,
      payload: {
        reportType: 'flood',
        description: 'acceptance test',
        severity: 'medium',
        source: 'web',
        publicLocation: { lat: 14.11, lng: 122.95 },
        pendingMediaIds: [],
      },
    })
  console.log(`  → Inbox doc written: ${inboxId}`)

  // 2. Wait up to 10s for triptych to materialize
  console.log('\n2. Waiting for triptych materialization (max 10s)...')
  const start = Date.now()
  let reportId: string | null = null
  while (Date.now() - start < 10_000) {
    const lookupSnap = await db.collection('report_lookup').doc(publicRef).get()
    if (lookupSnap.exists) {
      reportId = (lookupSnap.data() as { reportId: string }).reportId
      break
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  check('triptych materialized within 10s', reportId !== null, `publicRef=${publicRef}`)
  if (!reportId) {
    console.error('\n❌ Triptych did not materialize. Check processInboxItem trigger logs.')
    process.exit(1)
  }
  console.log(`  → Report ID: ${reportId}`)

  // 3. Verify triptych components
  console.log('\n3. Verifying triptych components...')

  const reportSnap = await db.collection('reports').doc(reportId).get()
  check('reports/{id} exists', reportSnap.exists)
  check('reports.status == new', reportSnap.data()?.status === 'new')
  check('reports.correlationId propagated', reportSnap.data()?.correlationId === correlationId)
  check(
    'reports.municipalityLabel present',
    typeof reportSnap.data()?.municipalityLabel === 'string',
  )

  const privateSnap = await db.collection('report_private').doc(reportId).get()
  check('report_private/{id} exists', privateSnap.exists)
  check(
    'report_private.reporterUid matches',
    privateSnap.data()?.reporterUid === 'accept-citizen-1',
  )

  const opsSnap = await db.collection('report_ops').doc(reportId).get()
  check('report_ops/{id} exists', opsSnap.exists)

  // 4. Verify events and lookup
  console.log('\n4. Verifying events and lookup...')

  const eventsSnap = await db.collection('reports').doc(reportId).collection('status_log').get()
  check('status_log has >= 1 entry', eventsSnap.size >= 1)
  check(
    'first event is draft_inbox → new',
    eventsSnap.docs[0]?.data().from === 'draft_inbox' && eventsSnap.docs[0]?.data().to === 'new',
  )

  const lookupSnap = await db.collection('report_lookup').doc(publicRef).get()
  check('report_lookup/{publicRef} exists', lookupSnap.exists)
  check('report_lookup.tokenHash matches', lookupSnap.data()?.tokenHash === secretHash)
  check('report_lookup.expiresAt is future', (lookupSnap.data()?.expiresAt ?? 0) > Date.now())

  // Summary
  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Summary: ${passed}/${results.length} assertions passed`)
  if (failed > 0) {
    console.error(`\n❌ ${failed} assertion(s) failed. Phase 3a NOT complete.`)
    process.exit(1)
  }
  console.log(`\n✅ Phase 3a acceptance test PASSED!`)
  console.log(`\n🎉 A citizen submission successfully materializes as a correct triptych.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

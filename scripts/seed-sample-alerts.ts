/**
 * Seed Sample Alerts into Firestore (local emulator)
 *
 * Usage:
 *   firebase emulators:exec "npx tsx scripts/seed-sample-alerts.ts"
 *   firebase emulators:exec "npx tsx scripts/seed-sample-alerts.ts -- --clear"   # clear before seeding
 *
 * Prerequisites:
 *   - Firebase emulators running (or started by firebase emulators:exec)
 *   - Dependencies installed: npm install
 */

import admin from 'firebase-admin'

// Initialize Firebase Admin — picks up FIREBASE_EMULATOR_HOST from the environment
// set automatically by `firebase emulators:exec`
admin.initializeApp()

const db = admin.firestore()

// ── Sample Alerts ─────────────────────────────────────────────────────────────

const sampleAlerts = [
  {
    title: 'MANDATORY EVACUATION ORDER',
    message:
      'All residents within 500m of Daet River are ordered to evacuate immediately due to rising water levels.',
    severity: 'emergency' as const,
    type: 'evacuation' as const,
    affectedAreas: { municipalities: ['daet'], barangays: ['Bagasbas', 'Centro'] },
    source: 'MDRRMO' as const,
    sourceUrl: 'https://mdrrmo.daet.gov.ph/advisory',
    targetAudience: 'municipality' as const,
    targetMunicipality: 'daet',
    deliveryMethod: ['push', 'in_app', 'sms'] as const,
    isActive: true,
  },
  {
    title: 'TYPHOON SIGNAL #2 ADVISORY',
    message:
      'PAGASA has raised Tropical Cyclone Wind Signal No. 2 for Camarines Norte. Expect winds of 61-120 km/h.',
    severity: 'warning' as const,
    type: 'weather' as const,
    affectedAreas: {
      municipalities: ['daet', 'labo', 'jose_panganiban', 'camarines_norte'],
    },
    source: 'PAGASA' as const,
    targetAudience: 'all' as const,
    deliveryMethod: ['push', 'in_app'] as const,
    isActive: true,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  },
  {
    title: 'ROAD CLOSURE: Daet-Labo Road',
    message: 'DPWH reports road closure due to landslide. Use alternate routes via San Lorenzo.',
    severity: 'warning' as const,
    type: 'infrastructure' as const,
    affectedAreas: { municipalities: ['daet', 'labo'] },
    source: 'DPWH' as const,
    targetAudience: 'all' as const,
    deliveryMethod: ['in_app'] as const,
    isActive: true,
  },
  {
    title: 'DENGUE OUTBREAK ALERT',
    message:
      'DOH reports elevated dengue cases in Jose Panganiban. Remove standing water and seek medical attention for fever.',
    severity: 'warning' as const,
    type: 'health' as const,
    affectedAreas: { municipalities: ['jose_panganiban'] },
    source: 'DOH' as const,
    targetAudience: 'municipality' as const,
    targetMunicipality: 'jose_panganiban',
    deliveryMethod: ['push', 'in_app'] as const,
    isActive: true,
  },
  {
    title: 'SYSTEM UPDATE: New Report Feature',
    message: 'Bantayog Alert now supports photo uploads in incident reports.',
    severity: 'info' as const,
    targetAudience: 'all' as const,
    deliveryMethod: ['in_app'] as const,
    isActive: true,
  },
]

// ── Seed Logic ───────────────────────────────────────────────────────────────

async function clearAlerts(): Promise<void> {
  const snapshot = await db.collection('alerts').get()
  if (snapshot.empty) {
    console.log('[seed] No existing alerts to clear.')
    return
  }

  const batch = db.batch()
  snapshot.docs.forEach((doc) => batch.delete(doc.ref))
  await batch.commit()
  console.log(`[seed] Cleared ${snapshot.size} existing alert(s).`)
}

async function seedAlerts(): Promise<void> {
  const batch = db.batch()

  sampleAlerts.forEach((alert, index) => {
    const docRef = db.collection('alerts').doc()
    batch.set(docRef, {
      ...alert,
      createdAt: Date.now(),
      createdBy: 'seed-script',
    })
    console.log(`[seed] Queued alert ${index + 1}: ${alert.title}`)
  })

  await batch.commit()
  console.log(`[seed] Seeded ${sampleAlerts.length} alert(s).`)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const shouldClear = args.includes('--clear')

  console.log('[seed] Starting seed...')

  if (shouldClear) {
    await clearAlerts()
  }

  await seedAlerts()
  console.log('[seed] Done.')

  // Give the emulator a moment to process, then exit cleanly
  process.exit(0)
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error('[seed] Error:', message)
  process.exit(1)
})

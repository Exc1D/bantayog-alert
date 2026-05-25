#!/usr/bin/env node
/**
 * Seed script for Firestore emulator responders collection.
 * Run: node scripts/seed-demo-responders.mjs
 *
 * Requires: the Firestore emulator is running on 127.0.0.1:8081
 */
import { initializeApp } from 'firebase/app'
import { getFirestore, connectFirestoreEmulator, doc, setDoc } from 'firebase/firestore'

const firebaseConfig = {
  projectId: 'bantayog-alert-staging',
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
connectFirestoreEmulator(db, '127.0.0.1', 8081)

const responders = [
  {
    uid: 'demo-r1',
    displayName: 'Santos, R.',
    availabilityStatus: 'available',
    accountStatus: 'active',
    lastSeenAt: Date.now(),
    agencyId: 'bfp-manila',
    municipalityId: 'manila',
    specializations: ['medical', 'rescue'],
    updatedAt: Date.now(),
  },
  {
    uid: 'demo-r2',
    displayName: 'Reyes, M.',
    availabilityStatus: 'off_duty',
    accountStatus: 'active',
    lastSeenAt: Date.now() - 10 * 60 * 1000,
    agencyId: 'pnp-quezon',
    municipalityId: 'quezon-city',
    specializations: ['traffic', 'crowd-control'],
    updatedAt: Date.now(),
  },
  {
    uid: 'demo-r3',
    displayName: 'Cruz, J.',
    availabilityStatus: 'unavailable',
    accountStatus: 'active',
    lastSeenAt: Date.now() - 60 * 60 * 1000,
    agencyId: 'bfp-manila',
    municipalityId: 'manila',
    updatedAt: Date.now(),
  },
]

async function seed() {
  for (const r of responders) {
    await setDoc(doc(db, 'responders', r.uid), r)
    console.log(`Seeded ${r.displayName} (${r.availabilityStatus})`)
  }
  console.log(`Done — ${responders.length} responders seeded`)
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})

/**
 * Seed Break-Glass Configuration
 *
 * Creates the system_config/break_glass_config document with two
 * bcrypt-hashed emergency codes. The plaintext codes are printed
 * once and never stored — record them securely.
 *
 * Idempotent: if the document already exists, exits without changes.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json pnpm exec tsx scripts/seed-break-glass-config.ts
 */

import { randomBytes } from 'node:crypto'

import * as bcrypt from 'bcryptjs'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const COST_FACTOR = 12
const CONFIG_DOC = 'system_config/break_glass_config'

if (getApps().length === 0) {
  initializeApp()
}

const db = getFirestore()

async function main() {
  const existing = await db.doc(CONFIG_DOC).get()
  if (existing.exists) {
    console.log('Break-glass config already exists. No changes made.')
    return
  }

  const codeA = randomBytes(16).toString('hex')
  const codeB = randomBytes(16).toString('hex')
  const [hashA, hashB] = await Promise.all([
    bcrypt.hash(codeA, COST_FACTOR),
    bcrypt.hash(codeB, COST_FACTOR),
  ])

  await db.doc(CONFIG_DOC).set({ hashedCodes: [hashA, hashB] })

  console.log('Break-glass codes seeded. Store these securely:')
  console.log(`Controller A: ${codeA}`)
  console.log(`Controller B: ${codeB}`)
  console.log('These values will NOT be shown again.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

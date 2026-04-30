#!/usr/bin/env tsx
/**
 * Post-deploy smoke test. Tests Firestore, RTDB, Storage, BigQuery, and system_config docs.
 * Exits non-zero on any failure. Do not proceed to Track 1 Step 8 if this fails.
 *
 * Usage: npx tsx functions/scripts/smoke-test-prod.ts [project-id]
 * Requires: GOOGLE_APPLICATION_CREDENTIALS or ADC
 */
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { getDatabase } from 'firebase-admin/database'
import { getStorage } from 'firebase-admin/storage'
import { BigQuery } from '@google-cloud/bigquery'

const project = process.argv[2] ?? 'bantayog-alert'
const rtdbUrl = `https://${project}-default-rtdb.asia-southeast1.firebasedatabase.app`

if (getApps().length === 0) {
  initializeApp({ projectId: project, databaseURL: rtdbUrl })
}

const fsdb = getFirestore()
const rtdb = getDatabase()
const storage = getStorage()
const bq = new BigQuery({ projectId: project })

type CheckResult = { name: string; ok: boolean; error?: string }

async function checkFirestore(): Promise<CheckResult> {
  const name = 'Firestore read/write'
  try {
    const ref = fsdb.collection('_smoke_test').doc('probe')
    await ref.set({ ts: Timestamp.now(), smoke: true })
    const snap = await ref.get()
    if (!snap.exists) throw new Error('read-back failed')
    await ref.delete()
    return { name, ok: true }
  } catch (err) {
    return { name, ok: false, error: String(err) }
  }
}

async function checkRtdb(): Promise<CheckResult> {
  const name = 'RTDB read/write'
  try {
    const ref = rtdb.ref('_smoke_test/probe')
    await ref.set({ ts: Date.now() })
    const snap = await ref.once('value')
    if (!snap.exists()) throw new Error('read-back failed')
    await ref.remove()
    return { name, ok: true }
  } catch (err) {
    return { name, ok: false, error: String(err) }
  }
}

async function checkStorage(): Promise<CheckResult> {
  const name = 'Storage read/write'
  try {
    const bucket = storage.bucket()
    await bucket.getMetadata()
    const testFile = bucket.file('_smoke_test/probe.txt')
    await testFile.save('smoke-test', { contentType: 'text/plain' })
    const [exists] = await testFile.exists()
    if (!exists) throw new Error('write-back failed')
    await testFile.delete()
    return { name, ok: true }
  } catch (err) {
    return { name, ok: false, error: String(err) }
  }
}

async function checkDoc(docPath: string, requiredFields: string[]): Promise<CheckResult> {
  const name = docPath
  try {
    const parts = docPath.split('/')
    if (parts.length < 2 || parts.some((p) => !p)) throw new Error('invalid doc path')
    const collection = parts[0]
    const docId = parts.slice(1).join('/')
    const snap = await fsdb.collection(collection).doc(docId).get()
    if (!snap.exists) throw new Error('document missing')
    const data = snap.data() ?? {}
    for (const field of requiredFields) {
      if (data[field] === undefined) throw new Error(`field missing: ${field}`)
    }
    return { name, ok: true }
  } catch (err) {
    return { name, ok: false, error: String(err) }
  }
}

async function checkBigQuery(): Promise<CheckResult> {
  const name = 'BigQuery audit table accessible'
  try {
    const table = bq.dataset('bantayog_audit').table('streaming_events')
    const [exists] = await table.exists()
    if (!exists) throw new Error('table does not exist')
    const [metadata] = await table.getMetadata()
    if (!metadata.schema) throw new Error('table has no schema')
    return { name, ok: true }
  } catch (err) {
    return { name, ok: false, error: String(err) }
  }
}

async function main(): Promise<void> {
  console.log(`Smoke test — project: ${project}\n`)

  const results = await Promise.all([
    checkFirestore(),
    checkRtdb(),
    checkStorage(),
    checkDoc('system_config/min_app_version', ['citizen', 'admin', 'responder']),
    checkDoc('system_config/update_urls', ['citizen', 'admin', 'responder']),
    checkBigQuery(),
  ])

  const failed: CheckResult[] = []
  for (const r of results) {
    const icon = r.ok ? 'ok' : 'FAIL'
    const detail = r.error ? ` — ${r.error}` : ''
    console.log(`[${icon}] ${r.name}${detail}`)
    if (!r.ok) failed.push(r)
  }

  if (failed.length > 0) {
    console.error(`\n${failed.length} check(s) failed. Fix before proceeding.`)
    process.exit(1)
  }

  console.log('\nAll checks passed.')
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})

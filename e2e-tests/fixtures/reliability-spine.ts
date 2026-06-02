import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth, type Auth, type UserRecord } from 'firebase-admin/auth'
import { getDatabase, type Database } from 'firebase-admin/database'
import {
  getFirestore,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  type Firestore,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from 'firebase-admin/firestore'

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export type ProofTarget = 'local' | 'staging'

export interface ProofEnvironment {
  target: ProofTarget
  projectId: string
  citizenBaseUrl: string
  adminBaseUrl: string
  responderBaseUrl: string
}

export interface ProofLedger {
  testRunId: string
  target: ProofTarget
  municipalityId: string
  clientDraftRef?: string
  publicRef?: string
  reportId?: string
  alertId?: string
  dispatchId?: string
  adminUid?: string
  responderUid?: string
}

export interface CheckpointResult {
  testRunId: string
  checkpoint: string
  status: 'passed' | 'failed'
  target: ProofTarget
  expected: string
  observed: Record<string, unknown>
  nextHint?: string
}

export interface ManualInboxResult {
  clientDraftRef: string
  status: 'processed' | 'failed'
  reportId?: string
  publicRef?: string
  error?: string
}

export interface ManualInboxSummary {
  candidateCount: number
  processedCount: number
  failedCount: number
  skippedCount: number
  exitCode: number
  signal: NodeJS.Signals | null
  results: ManualInboxResult[]
  stdout: string
  stderr: string
}

export interface ProofCleanupContext {
  db: Firestore
  auth?: Auth
  rtdb?: Database
}

export interface ProofPreflightContext {
  env: ProofEnvironment
  db: Firestore
  auth: Auth
}

export interface ProofCredentials {
  admin: { email: string; password: string; uid: string }
  responder: { email: string; password: string; uid: string }
}

function getEnvValue(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) return value
  }
  return undefined
}

export function getProofTarget(): ProofTarget {
  const rawTarget = process.env.BANTAYOG_PROOF_TARGET?.trim() ?? 'local'
  if (rawTarget === 'local' || rawTarget === 'staging') return rawTarget
  throw new Error(`Invalid BANTAYOG_PROOF_TARGET: ${rawTarget}`)
}

export function getProofEnvironment(): ProofEnvironment {
  const target = getProofTarget()
  const projectId = getEnvValue('BANTAYOG_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_PROJECT_ID')
  if (!projectId) {
    throw new Error('Missing Firebase project id for reliability spine proof')
  }

  if (/prod|production/i.test(projectId)) {
    throw new Error(`Refusing to run proof against production project: ${projectId}`)
  }

  if (target === 'local') {
    return {
      target,
      projectId,
      citizenBaseUrl: process.env.BANTAYOG_CITIZEN_URL ?? 'http://localhost:5173',
      adminBaseUrl: process.env.BANTAYOG_ADMIN_URL ?? 'http://localhost:5175',
      responderBaseUrl: process.env.BANTAYOG_RESPONDER_URL ?? 'http://localhost:5174',
    }
  }

  const citizenBaseUrl =
    process.env.BANTAYOG_CITIZEN_URL ?? 'https://bantayog-citizen-staging.web.app'
  const adminBaseUrl = process.env.BANTAYOG_ADMIN_URL
  const responderBaseUrl = process.env.BANTAYOG_RESPONDER_URL

  if (!adminBaseUrl || !responderBaseUrl) {
    throw new Error(
      'Staging proof requires BANTAYOG_ADMIN_URL and BANTAYOG_RESPONDER_URL to be set explicitly',
    )
  }

  return { target, projectId, citizenBaseUrl, adminBaseUrl, responderBaseUrl }
}

function configureLocalEmulators(): void {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8081'
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099'
  process.env.FIREBASE_DATABASE_EMULATOR_HOST ??= '127.0.0.1:9000'
}

export function getProofDatabaseURL(input: {
  target: ProofTarget
  projectId: string
  databaseHost?: string
}): string | undefined {
  if (input.target === 'local') {
    return `http://${input.databaseHost ?? '127.0.0.1:9000'}?ns=${input.projectId}`
  }
  return getEnvValue('BANTAYOG_DATABASE_URL', 'FIREBASE_DATABASE_URL')
}

function getProofApp(): ReturnType<typeof initializeApp> {
  const { projectId, target } = getProofEnvironment()
  if (target === 'local') {
    configureLocalEmulators()
  }
  const databaseURL = getProofDatabaseURL({
    target,
    projectId,
    databaseHost: process.env.FIREBASE_DATABASE_EMULATOR_HOST,
  })
  return getApps()[0] ?? initializeApp({ projectId, ...(databaseURL ? { databaseURL } : {}) })
}

export function getProofFirestore(): Firestore {
  return getFirestore(getProofApp())
}

export function getProofAuth(): Auth {
  return getAuth(getProofApp())
}

export function getProofRealtimeDatabase(): Database {
  return getDatabase(getProofApp())
}

function requireProofEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Staging proof requires ${name}`)
  return value
}

async function requireActiveAccount(
  db: Firestore,
  input: { uid: string; role: string; municipalityId: string; label: string },
): Promise<void> {
  const snap = await db.collection('active_accounts').doc(input.uid).get()
  if (!snap.exists) {
    throw new Error(`Staging proof ${input.label} active_accounts/${input.uid} is missing`)
  }

  const data = snap.data() ?? {}
  if (data.accountStatus !== 'active') {
    throw new Error(`Staging proof ${input.label} account is not active`)
  }
  if (data.role !== input.role) {
    throw new Error(`Staging proof ${input.label} role must be ${input.role}`)
  }
  if (data.municipalityId !== input.municipalityId) {
    throw new Error(`Staging proof ${input.label} municipalityId must be ${input.municipalityId}`)
  }
}

export async function preflightProofServices({
  env,
  db,
  auth,
}: ProofPreflightContext): Promise<void> {
  if (env.target === 'local') return

  const emulatorEnv = [
    'FIRESTORE_EMULATOR_HOST',
    'FIREBASE_AUTH_EMULATOR_HOST',
    'FIREBASE_DATABASE_EMULATOR_HOST',
  ].filter((name) => process.env[name]?.trim())
  if (emulatorEnv.length > 0) {
    throw new Error(`Staging proof must not use emulator env: ${emulatorEnv.join(', ')}`)
  }

  const adminUid = requireProofEnv('BANTAYOG_ADMIN_UID')
  const responderUid = requireProofEnv('BANTAYOG_RESPONDER_UID')
  const adminEmail = requireProofEnv('BANTAYOG_ADMIN_EMAIL')
  const responderEmail = requireProofEnv('BANTAYOG_RESPONDER_EMAIL')
  requireProofEnv('BANTAYOG_ADMIN_PASSWORD')
  requireProofEnv('BANTAYOG_RESPONDER_PASSWORD')

  const [adminUser, responderUser] = await Promise.all([
    auth.getUser(adminUid),
    auth.getUser(responderUid),
  ])
  if (adminUser.email !== adminEmail) {
    throw new Error(`Staging proof admin uid/email mismatch for ${adminUid}`)
  }
  if (responderUser.email !== responderEmail) {
    throw new Error(`Staging proof responder uid/email mismatch for ${responderUid}`)
  }

  await Promise.all([
    requireActiveAccount(db, {
      uid: adminUid,
      role: 'municipal_admin',
      municipalityId: 'daet',
      label: 'admin',
    }),
    requireActiveAccount(db, {
      uid: responderUid,
      role: 'responder',
      municipalityId: 'daet',
      label: 'responder',
    }),
  ])
}

async function upsertAuthUser(
  auth: Auth,
  input: { uid: string; email: string; password: string },
): Promise<UserRecord> {
  try {
    const user = await auth.getUserByEmail(input.email)
    await auth.updateUser(user.uid, { password: input.password })
    return user
  } catch (err: unknown) {
    if (!isAuthUserNotFound(err)) {
      throw err
    }
  }

  return auth.createUser({
    uid: input.uid,
    email: input.email,
    password: input.password,
  })
}

export function isAuthUserNotFound(err: unknown): boolean {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code)
      : ''
  const message = err instanceof Error ? err.message : String(err)
  return (
    code === 'auth/user-not-found' ||
    message.includes('auth/user-not-found') ||
    message.includes('user not found')
  )
}

async function seedAdminUser(
  auth: Auth,
  db: Firestore,
): Promise<{ email: string; password: string; uid: string }> {
  const email = 'daet-admin-test-01@test.local'
  const password = 'test123456'
  const uid = 'daet-admin-test-01'

  await upsertAuthUser(auth, { uid, email, password })
  await auth.setCustomUserClaims(uid, {
    role: 'municipal_admin',
    accountStatus: 'active',
    municipalityId: 'daet',
  })
  await db.collection('active_accounts').doc(uid).set({
    uid,
    role: 'municipal_admin',
    accountStatus: 'active',
    municipalityId: 'daet',
    lastClaimIssuedAt: Date.now(),
    updatedAt: Date.now(),
  })

  return { email, password, uid }
}

async function seedResponderUser(
  auth: Auth,
  db: Firestore,
): Promise<{ email: string; password: string; uid: string }> {
  const email = 'bfp-responder-test-01@test.local'
  const password = 'test123456'
  const uid = 'bfp-responder-test-01'

  await upsertAuthUser(auth, { uid, email, password })
  await auth.setCustomUserClaims(uid, {
    role: 'responder',
    accountStatus: 'active',
    municipalityId: 'daet',
    agencyId: 'bfp-daet',
  })
  await db.collection('active_accounts').doc(uid).set({
    uid,
    role: 'responder',
    accountStatus: 'active',
    municipalityId: 'daet',
    agencyId: 'bfp-daet',
    permittedMunicipalityIds: [],
    mfaEnrolled: true,
    lastClaimIssuedAt: Date.now(),
    updatedAt: Date.now(),
  })
  await db.collection('responders').doc(uid).set({
    uid,
    displayName: 'BFP Daet Test Responder',
    agency: 'BFP',
    agencyId: 'BFP',
    municipalityId: 'daet',
    isActive: true,
    availabilityStatus: 'available',
    updatedAt: Date.now(),
  })

  return { email, password, uid }
}

async function seedResponderLocation(rtdb: Database, input: { uid: string }): Promise<void> {
  await rtdb.ref(`responder_index/${input.uid}`).set({
    municipalityId: 'daet',
    agencyId: 'BFP',
  })
  await rtdb.ref(`responder_index/daet/${input.uid}`).set({
    isOnShift: true,
    agencyId: 'BFP',
  })
  await rtdb.ref(`responder_locations/${input.uid}`).set({
    uid: input.uid,
    displayName: 'BFP Daet Test Responder',
    agency: 'BFP',
  })
}

async function seedProofMunicipality(db: Firestore): Promise<void> {
  await db
    .collection('municipalities')
    .doc('daet')
    .set(
      {
        id: 'daet',
        label: 'Daet',
        provinceId: 'camarines-norte',
        centroid: { lat: 14.1, lng: 122.95 },
        schemaVersion: 1,
      },
      { merge: true },
    )
}

export async function seedLocalProofAccounts(): Promise<ProofCredentials> {
  const auth = getProofAuth()
  const db = getProofFirestore()
  const rtdb = getProofRealtimeDatabase()

  await seedProofMunicipality(db)
  const admin = await seedAdminUser(auth, db)
  const responder = await seedResponderUser(auth, db)

  await seedResponderLocation(rtdb, { uid: responder.uid })

  return { admin, responder }
}

export function createProofLedger(): ProofLedger {
  return {
    testRunId: `reliability-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`,
    target: getProofTarget(),
    municipalityId: 'daet',
  }
}

export function logCheckpoint(result: CheckpointResult): void {
  console.log(JSON.stringify({ event: 'reliability-spine-checkpoint', ...result }))
}

export async function waitForDoc<T extends DocumentData>(
  ref: DocumentReference<T>,
  timeoutMs: number,
  intervalMs = 250,
): Promise<DocumentSnapshot<T & DocumentData>> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const snapshot = await ref.get()
    if (snapshot.exists) return snapshot
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  throw new Error(`Timed out waiting for ${ref.path}`)
}

export async function waitForQueryExactlyOne<T extends DocumentData>(
  read: () => Promise<QuerySnapshot<T>>,
  timeoutMs: number,
  label: string,
  intervalMs = 250,
): Promise<QueryDocumentSnapshot<T>> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const snapshot = await read()
    if (snapshot.docs.length === 1) {
      return snapshot.docs[0]
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  throw new Error(`Timed out waiting for exactly one ${label}`)
}

export async function waitForQueryAtLeastOne<T extends DocumentData>(
  read: () => Promise<QuerySnapshot<T>>,
  timeoutMs: number,
  label: string,
  intervalMs = 250,
): Promise<QuerySnapshot<T>> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const snapshot = await read()
    if (snapshot.docs.length > 0) return snapshot
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  throw new Error(`Timed out waiting for ${label}`)
}

export async function runManualInboxProcessor(): Promise<ManualInboxSummary> {
  const command = 'pnpm'
  const args = ['--dir', 'functions', 'exec', 'tsx', 'scripts/process-inbox-manual.ts']
  const child = spawn(command, args, {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8081',
      FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  })

  const stdoutChunks: Buffer[] = []
  const stderrChunks: Buffer[] = []
  let exitSignal: NodeJS.Signals | null = null
  child.stdout.on('data', (chunk: Buffer) => {
    stdoutChunks.push(chunk)
  })
  child.stderr.on('data', (chunk: Buffer) => {
    stderrChunks.push(chunk)
  })

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.on('error', reject)
    child.on('exit', (code, signal) => {
      exitSignal = signal
      resolve(code ?? 0)
    })
  })

  const stdout = Buffer.concat(stdoutChunks).toString('utf8')
  const stderr = Buffer.concat(stderrChunks).toString('utf8')
  const results: ManualInboxResult[] = []
  let candidateCount = 0
  let currentClientDraftRef: string | null = null

  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trimEnd()
    const candidateMatch = /^Found (\d+) unprocessed inbox item\(s\)\.$/.exec(line)
    if (candidateMatch) {
      candidateCount = Number(candidateMatch[1])
      continue
    }

    const processingMatch = /^Processing inbox (.+)\.\.\.$/.exec(line)
    if (processingMatch) {
      currentClientDraftRef = processingMatch[1]
      continue
    }

    const processedMatch =
      /^✅ Materialized: (true|false), Report ID: ([^,]+), Public Ref: (.+)$/.exec(line)
    if (processedMatch && currentClientDraftRef) {
      const materialized = processedMatch[1] === 'true'
      results.push({
        clientDraftRef: currentClientDraftRef,
        status: materialized ? 'processed' : 'failed',
        reportId: processedMatch[2].trim(),
        publicRef: processedMatch[3].trim(),
      })
      currentClientDraftRef = null
      continue
    }

    const failedMatch = /^❌ Failed: (.+)$/.exec(line)
    if (failedMatch && currentClientDraftRef) {
      results.push({
        clientDraftRef: currentClientDraftRef,
        status: 'failed',
        error: failedMatch[1].trim(),
      })
      currentClientDraftRef = null
    }
  }

  if (candidateCount === 0 && results.length > 0) {
    candidateCount = results.length
  }

  const processedCount = results.filter((result) => result.status === 'processed').length
  const failedCount = results.filter((result) => result.status === 'failed').length

  return {
    candidateCount,
    processedCount,
    failedCount,
    skippedCount: Math.max(0, candidateCount - processedCount - failedCount),
    exitCode,
    signal: exitSignal,
    results,
    stdout,
    stderr,
  }
}

export async function cleanupProofRun(
  services: ProofCleanupContext,
  ledger: ProofLedger,
): Promise<void> {
  const { db, auth, rtdb } = services
  const deletes: { label: string; run: () => Promise<unknown> }[] = []

  if (ledger.publicRef && !ledger.reportId) {
    const lookup = await db.collection('report_lookup').doc(ledger.publicRef).get()
    const reportId = lookup.data()?.reportId
    if (typeof reportId === 'string' && reportId) {
      ledger.reportId = reportId
    }
  }

  if (ledger.reportId && !ledger.dispatchId) {
    const dispatches = await db
      .collection('dispatches')
      .where('reportId', '==', ledger.reportId)
      .get()
    const dispatchId = dispatches.docs[0]?.id
    if (dispatchId) {
      ledger.dispatchId = dispatchId
    }
  }

  if (!ledger.alertId) {
    const alerts = await db
      .collection('alerts')
      .where('message', '==', `[TEST:${ledger.testRunId}] Flood proof alert`)
      .get()
    const alertId = alerts.docs[0]?.id
    if (alertId) {
      ledger.alertId = alertId
    }
  }

  if (ledger.dispatchId) {
    const dispatchId = ledger.dispatchId
    deletes.push({
      label: `dispatches/${dispatchId}`,
      run: () => db.collection('dispatches').doc(dispatchId).delete(),
    })
  }
  if (ledger.alertId) {
    const alertId = ledger.alertId
    deletes.push({
      label: `alerts/${alertId}`,
      run: () => db.collection('alerts').doc(alertId).delete(),
    })
  }
  if (ledger.reportId) {
    const reportId = ledger.reportId
    deletes.push({
      label: `report_private/${reportId}`,
      run: () => db.collection('report_private').doc(reportId).delete(),
    })
    deletes.push({
      label: `report_ops/${reportId}`,
      run: () => db.collection('report_ops').doc(reportId).delete(),
    })
    deletes.push({
      label: `reports/${reportId}`,
      run: () => db.collection('reports').doc(reportId).delete(),
    })
  }
  if (ledger.publicRef) {
    const publicRef = ledger.publicRef
    deletes.push({
      label: `report_lookup/${publicRef}`,
      run: () => db.collection('report_lookup').doc(publicRef).delete(),
    })
  }
  if (ledger.clientDraftRef) {
    const clientDraftRef = ledger.clientDraftRef
    deletes.push({
      label: `report_inbox/${clientDraftRef}`,
      run: () => db.collection('report_inbox').doc(clientDraftRef).delete(),
    })
  }
  if (ledger.adminUid) {
    const adminUid = ledger.adminUid
    deletes.push({
      label: `active_accounts/${adminUid}`,
      run: () => db.collection('active_accounts').doc(adminUid).delete(),
    })
    if (auth) {
      deletes.push({
        label: `auth/${adminUid}`,
        run: () => auth.deleteUser(adminUid),
      })
    }
  }
  if (ledger.responderUid) {
    const responderUid = ledger.responderUid
    deletes.push({
      label: `active_accounts/${responderUid}`,
      run: () => db.collection('active_accounts').doc(responderUid).delete(),
    })
    deletes.push({
      label: `responders/${responderUid}`,
      run: () => db.collection('responders').doc(responderUid).delete(),
    })
    if (auth) {
      deletes.push({
        label: `auth/${responderUid}`,
        run: () => auth.deleteUser(responderUid),
      })
    }
    if (rtdb) {
      deletes.push({
        label: `responder_index/${responderUid}`,
        run: () => rtdb.ref(`responder_index/${responderUid}`).set(null),
      })
      deletes.push({
        label: `responder_index/daet/${responderUid}`,
        run: () => rtdb.ref(`responder_index/daet/${responderUid}`).set(null),
      })
      deletes.push({
        label: `responder_locations/${responderUid}`,
        run: () => rtdb.ref(`responder_locations/${responderUid}`).set(null),
      })
    }
  }

  const results = await Promise.allSettled(deletes.map((op) => op.run()))
  const failures = results
    .map((result, index) => ({ result, label: deletes[index]?.label ?? 'unknown' }))
    .filter(
      (entry): entry is { result: PromiseRejectedResult; label: string } =>
        entry.result.status === 'rejected',
    )
  if (failures.length > 0) {
    throw new AggregateError(
      failures.map((failure) => failure.result.reason),
      `Proof cleanup failed for: ${failures.map((failure) => failure.label).join(', ')}`,
    )
  }
}

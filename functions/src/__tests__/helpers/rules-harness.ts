import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'

const FIRESTORE_RULES_PATH = resolve(process.cwd(), '../infra/firebase/firestore.rules')
const RTDB_RULES_PATH = resolve(process.cwd(), '../infra/firebase/database.rules.json')
const STORAGE_RULES_PATH = resolve(process.cwd(), '../infra/firebase/storage.rules')

interface HubEmulatorConfig {
  host: string
  port: number
  state?: string
  listen?: { address: string; port: number }[]
}

interface HubResponse {
  firestore?: HubEmulatorConfig
  database?: HubEmulatorConfig
  storage?: HubEmulatorConfig
}

function extractEmulatorHostPort(
  emulator: HubEmulatorConfig | undefined,
): { host: string; port: number } | null {
  if (!emulator) return null
  const host = emulator.host
  const port = emulator.port
  if (typeof port !== 'number' || port <= 0) {
    console.warn(`[rules-harness] skipping emulator with invalid port: ${JSON.stringify(emulator)}`)
    return null
  }
  return { host, port }
}

function isEmulatorRunning(emulator: HubEmulatorConfig | undefined): boolean {
  if (!emulator) return false
  // If the hub reports a state field, require it to be "running".
  // Absent state field is treated as running (for hub versions that omit it).
  if ('state' in emulator) {
    return emulator.state === 'running'
  }
  return true
}

export async function createTestEnv(projectId: string): Promise<RulesTestEnvironment> {
  // Poll the hub until Firestore registers and is in running state, or time out after 30 attempts (15s with 500ms poll).
  let hubData: HubResponse | null = null
  let lastHubError: unknown = null
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://localhost:4400/emulators', {
        signal: AbortSignal.timeout(500),
      })
      if (res.ok) {
        hubData = (await res.json()) as HubResponse
        // Check both presence AND running state
        if (hubData.firestore && isEmulatorRunning(hubData.firestore)) break
      }
    } catch (err: unknown) {
      lastHubError = err
    }
    await new Promise((r) => setTimeout(r, 500))
  }

  if (!hubData?.firestore || !isEmulatorRunning(hubData.firestore)) {
    const lastErrorMsg =
      lastHubError instanceof Error ? ` Last hub error: ${lastHubError.message}` : ''
    throw new Error(
      '[rules-harness] Firestore emulator did not register with the hub after 15s. ' +
        'Ensure `firebase emulators:exec` is running with `--only firestore` (or `--only firestore,database,storage`).' +
        lastErrorMsg,
    )
  }

  // Even after registration, Firestore needs a moment to start accepting gRPC connections.
  await new Promise((r) => setTimeout(r, 2000))

  // Build config dynamically based on which emulators the hub reports as running.
  // This avoids connection errors when only a subset of emulators is started.
  const config: Parameters<typeof initializeTestEnvironment>[0] = { projectId }

  const firestoreInfo = extractEmulatorHostPort(hubData.firestore)
  if (firestoreInfo && isEmulatorRunning(hubData.firestore)) {
    config.firestore = {
      host: firestoreInfo.host,
      port: firestoreInfo.port,
      rules: readFileSync(FIRESTORE_RULES_PATH, 'utf8'),
    }
  }

  const databaseInfo = extractEmulatorHostPort(hubData.database)
  if (databaseInfo && isEmulatorRunning(hubData.database)) {
    config.database = {
      host: databaseInfo.host,
      port: databaseInfo.port,
      rules: readFileSync(RTDB_RULES_PATH, 'utf8'),
    }
  }

  const storageInfo = extractEmulatorHostPort(hubData.storage)
  if (storageInfo && isEmulatorRunning(hubData.storage)) {
    config.storage = {
      host: storageInfo.host,
      port: storageInfo.port,
      rules: readFileSync(STORAGE_RULES_PATH, 'utf8'),
    }
  }

  if (Object.keys(config).length === 1) {
    throw new Error(
      '[rules-harness] No emulators reported as running by the hub. ' +
        'Check that the emulator suite started successfully and all requested services are enabled.',
    )
  }

  try {
    return await initializeTestEnvironment(config)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`[rules-harness] initializeTestEnvironment failed: ${message}`, { cause: err })
  }
}

export function authed(env: RulesTestEnvironment, uid: string, claims: Record<string, unknown>) {
  return env.authenticatedContext(uid, claims).firestore()
}

export function unauthed(env: RulesTestEnvironment) {
  return env.unauthenticatedContext().firestore()
}

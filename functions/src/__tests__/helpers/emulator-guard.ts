import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
  type TestEnvironmentConfig,
} from '@firebase/rules-unit-testing'

export interface GuardedEnv {
  env: RulesTestEnvironment | undefined
  available: boolean
}

interface HostAndPort {
  host: string
  port: number
}

function hasHostAndPort(config: unknown): config is HostAndPort {
  return (
    typeof config === 'object' &&
    config !== null &&
    'host' in config &&
    'port' in config &&
    typeof (config as Record<string, unknown>).host === 'string' &&
    typeof (config as Record<string, unknown>).port === 'number'
  )
}

async function probeFirestore(host: string, port: number): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => {
      controller.abort()
    }, 2000)
    const response = await fetch(`http://${host}:${String(port)}`, {
      method: 'GET',
      signal: controller.signal,
    })
    clearTimeout(timeout)
    return response.status === 200 || response.status === 404
  } catch {
    return false
  }
}

async function probeRtdb(host: string, port: number): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => {
      controller.abort()
    }, 2000)
    const response = await fetch(`http://${host}:${String(port)}/.json?ns=dummy`, {
      method: 'GET',
      signal: controller.signal,
    })
    clearTimeout(timeout)
    // RTDB returns 401 or 404 even when healthy
    return response.status === 401 || response.status === 404 || response.status === 200
  } catch {
    return false
  }
}

export async function guardInitTestEnvironment(
  config: TestEnvironmentConfig,
  label: string,
): Promise<GuardedEnv> {
  // Proactively check emulator connectivity before initializing.
  // initializeTestEnvironment() itself does NOT throw when the emulator
  // is down — it creates the env object but operations hang with retry
  // loops, causing tests to time out instead of being skipped.
  if (config.firestore && hasHostAndPort(config.firestore)) {
    const reachable = await probeFirestore(config.firestore.host, config.firestore.port)
    if (!reachable) {
      console.warn(
        `[${label}] Firestore emulator unavailable at ${config.firestore.host}:${String(config.firestore.port)}; tests will skip.`,
      )
      return { env: undefined, available: false }
    }
  }
  if (config.database && hasHostAndPort(config.database)) {
    const reachable = await probeRtdb(config.database.host, config.database.port)
    if (!reachable) {
      console.warn(
        `[${label}] RTDB emulator unavailable at ${config.database.host}:${String(config.database.port)}; tests will skip.`,
      )
      return { env: undefined, available: false }
    }
  }

  try {
    const env = await initializeTestEnvironment(config)
    return { env, available: true }
  } catch (err) {
    console.warn(`[${label}] Emulator initialization failed; tests will skip.`, err)
    return { env: undefined, available: false }
  }
}

import { adminDb } from '../admin-init.js'
import { logDimension } from '@bantayog/shared-validators'

const log = logDimension('monitorConfig')

export interface MonitorConfig {
  autoEscalationEnabled: boolean
  maxDispatchesPerRun: number
  maxEscalationsPerRun: number
  enableCircuitBreaker: boolean
  circuitBreakerThreshold: number
  circuitBreakerErrorThreshold: number
  updatedAt: number
  updatedBy: string
}

const DEFAULT_CONFIG: MonitorConfig = {
  autoEscalationEnabled: true,
  maxDispatchesPerRun: 50,
  maxEscalationsPerRun: 50,
  enableCircuitBreaker: true,
  circuitBreakerThreshold: 100,
  circuitBreakerErrorThreshold: 10,
  updatedAt: 0,
  updatedBy: 'system',
}

let cachedConfig: MonitorConfig | null = null
let cachedAt = 0
const CACHE_TTL_MS = 30000 // 30s

export async function getMonitorConfig(): Promise<MonitorConfig> {
  const now = Date.now()
  if (cachedConfig && now - cachedAt < CACHE_TTL_MS) {
    return cachedConfig
  }
  try {
    const snap = await adminDb.doc('system_config/monitor').get()
    const config = snap.exists
      ? { ...DEFAULT_CONFIG, ...(snap.data() as Partial<MonitorConfig>) }
      : DEFAULT_CONFIG
    cachedConfig = config
    cachedAt = now
    return config
  } catch (err) {
    log({
      severity: 'ERROR',
      code: 'monitor.config_read_failed',
      message: err instanceof Error ? err.message : 'Failed to read monitor config',
    })
    return DEFAULT_CONFIG
  }
}

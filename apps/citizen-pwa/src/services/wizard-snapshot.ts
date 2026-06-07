import localforage from 'localforage'
import type { LocationConfidence } from './draft-store'

interface SerializableStep1 {
  reportType: string
  description: string
  peopleInjured: boolean
  peopleTrapped: boolean
  urgencyReason?: string
}

interface SerializableStep2 {
  location: { lat: number; lng: number }
  reporterName: string
  reporterMsisdn: string
  locationMethod: 'gps' | 'manual'
  locationConfidence: LocationConfidence
  municipalityId?: string
  municipalityLabel?: string
  barangayId?: string
  nearestLandmark?: string
}

export interface WizardSnapshot {
  step: 1 | 2 | 3
  step1: SerializableStep1 | null
  step2: SerializableStep2 | null
  updatedAt: number
}

const TTL_MS = 24 * 60 * 60 * 1000
const STORAGE_KEY = 'wizard-in-progress'

interface SnapshotStorage {
  getItem(key: string): Promise<WizardSnapshot | null>
  setItem(key: string, value: WizardSnapshot): Promise<WizardSnapshot>
  removeItem(key: string): Promise<void>
}

let _storage: SnapshotStorage | undefined

export function _resetWizardSnapshotCache(): void {
  _storage = undefined
}

function getStorage(): SnapshotStorage {
  _storage ??= localforage.createInstance({
    name: 'bantayog-wizard',
    storeName: 'snapshot',
  }) as unknown as SnapshotStorage
  return _storage
}

export const wizardSnapshot = {
  async load(): Promise<WizardSnapshot | null> {
    let snapshot: WizardSnapshot | null
    try {
      snapshot = await getStorage().getItem(STORAGE_KEY)
    } catch {
      return null
    }
    if (!snapshot) return null
    if (Date.now() - snapshot.updatedAt > TTL_MS) {
      await this.clear()
      return null
    }
    return snapshot
  },

  async save(partial: Omit<WizardSnapshot, 'updatedAt'>): Promise<void> {
    const toSave: WizardSnapshot = { ...partial, updatedAt: Date.now() }
    try {
      await getStorage().setItem(STORAGE_KEY, toSave)
    } catch (err) {
      // Best-effort persistence — don't block step transitions if IDB fails.
      console.warn('[wizardSnapshot] Failed to save draft:', err)
    }
  },

  async clear(): Promise<void> {
    try {
      await getStorage().removeItem(STORAGE_KEY)
    } catch (err) {
      // Best-effort.
      console.warn('[wizardSnapshot] Failed to clear draft:', err)
    }
  },
}

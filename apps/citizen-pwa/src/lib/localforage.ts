import localforage from 'localforage'

export interface DraftReport {
  uuid: string
  reportType: string
  hazardClass: string
  description?: string
  location: {
    lat: number
    lng: number
    address?: string
  }
  reporterName: string
  reporterMsisdn: string
  patientCount: number
  photoUrl?: string
  createdAt: number
  smsFallbackSentAt?: number
  state: 'draft' | 'queued' | 'failed_retryable'
  submittedRef?: string
  lastError?: {
    code: string
    message: string
    timestamp: number
  }
  retryCount?: number
}

export interface SessionMetadata {
  uuid: string
  anonymousUid: string
  deviceInfo: {
    userAgent: string
    platform: string
  }
  createdAt: number
}

export const draftStore = localforage.createInstance({
  name: 'bantayog-drafts',
  storeName: 'drafts',
})

export const sessionStore = localforage.createInstance({
  name: 'bantayog-sessions',
  storeName: 'sessions',
})

export async function saveDraft(draft: DraftReport): Promise<void> {
  await draftStore.setItem(`draft:${draft.uuid}`, draft)
}

export async function getDraft(uuid: string): Promise<DraftReport | null> {
  return await draftStore.getItem<DraftReport>(`draft:${uuid}`)
}

export async function deleteDraft(uuid: string): Promise<void> {
  await draftStore.removeItem(`draft:${uuid}`)
}

export async function listDrafts(): Promise<DraftReport[]> {
  const keys = await draftStore.keys()
  const drafts = await Promise.all(
    keys.filter((k) => k.startsWith('draft:')).map((k) => draftStore.getItem<DraftReport>(k)),
  )
  return drafts.filter((d): d is DraftReport => d !== null)
}

export async function cleanupExpiredDrafts(): Promise<void> {
  const drafts = await listDrafts()
  const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000

  for (const draft of drafts) {
    if (draft.createdAt < twentyFourHoursAgo) {
      await deleteDraft(draft.uuid)
    }
  }
}
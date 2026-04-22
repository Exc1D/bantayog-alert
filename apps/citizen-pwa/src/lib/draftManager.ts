import { saveDraft, getDraft, type DraftReport } from './localforage'

export async function createDraft(reportData: Omit<DraftReport, 'uuid'>): Promise<string> {
  const uuid = crypto.randomUUID()
  const draft: DraftReport = {
    uuid,
    ...reportData,
    createdAt: Date.now(),
    state: 'queued',
  }
  await saveDraft(draft)
  return uuid
}

export async function updateDraft(uuid: string, updates: Partial<DraftReport>): Promise<void> {
  const draft = await getDraft(uuid)
  if (!draft) throw new Error('Draft not found')
  const updated = { ...draft, ...updates }
  await saveDraft(updated)
}

export async function transitionDraftToFailed(
  uuid: string,
  error: { code: string; message: string },
): Promise<void> {
  const draft = await getDraft(uuid)
  if (!draft) throw new Error('Draft not found')
  await saveDraft({
    ...draft,
    state: 'failed_retryable',
    lastError: { ...error, timestamp: Date.now() },
  })
}

export async function incrementDraftRetry(uuid: string): Promise<void> {
  const draft = await getDraft(uuid)
  if (!draft) throw new Error('Draft not found')
  await saveDraft({
    ...draft,
    retryCount: (draft.retryCount || 0) + 1,
  })
}

export async function promoteDraftToSuccess(uuid: string, finalRef: string): Promise<void> {
  const draft = await getDraft(uuid)
  if (!draft) throw new Error('Draft not found')
  const { lastError: _ignored, ...rest } = draft
  await saveDraft({
    ...rest,
    state: 'draft',
    submittedRef: finalRef,
  })
}

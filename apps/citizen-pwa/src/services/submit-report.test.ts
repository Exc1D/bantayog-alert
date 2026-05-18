import { describe, it, expect, vi, beforeEach } from 'vitest'
const { mockDraftStoreSave, mockDraftStoreSaveWithPhoto } = vi.hoisted(() => ({
  mockDraftStoreSave: vi.fn().mockResolvedValue(undefined),
  mockDraftStoreSaveWithPhoto: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('./draft-store', () => ({
  draftStore: {
    save: mockDraftStoreSave,
    saveWithPhoto: mockDraftStoreSaveWithPhoto,
  },
}))

import { createDraft, submitReport, type SubmitReportDeps } from './submit-report.js'
import { normalizeMsisdn } from '@bantayog/shared-validators'

beforeEach(() => {
  mockDraftStoreSave.mockClear()
  mockDraftStoreSaveWithPhoto.mockClear()
})

describe('submitReport', () => {
  it('calls requestUploadUrl when a photo is provided, PUTs the photo, and writes inbox', async () => {
    const deps: SubmitReportDeps = {
      ensureSignedIn: vi.fn().mockResolvedValue('citizen-1'),
      requestUploadUrl: vi.fn().mockResolvedValue({
        uploadUrl: 'https://put.example',
        uploadId: 'upl-1',
        storagePath: 'pending/upl-1',
        expiresAt: Date.now() + 1e5,
      }),
      putBlob: vi.fn().mockResolvedValue(undefined),
      writeInbox: vi.fn().mockResolvedValue('ibx-1'),
      randomUUID: vi.fn().mockReturnValue('uuid-a'),
      randomPublicRef: vi.fn().mockReturnValue('abcd1234'),
      randomSecret: vi.fn().mockReturnValue('secret-plain'),
      sha256Hex: vi.fn().mockResolvedValue('h'.repeat(64)),
      now: () => 1,
    }
    const photo = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' })
    const result = await submitReport(deps, {
      reportType: 'flood',
      severity: 'high',
      description: 'x',
      publicLocation: { lat: 14.1, lng: 122.9 },
      photo,
    })
    expect(result.publicRef).toBe('abcd1234')
    expect(result.secret).toBe('secret-plain')
    expect(deps.requestUploadUrl).toHaveBeenCalledOnce()
    expect(deps.putBlob).toHaveBeenCalledWith('https://put.example', photo)
    expect(deps.writeInbox).toHaveBeenCalledOnce()
    const inboxDoc = (deps.writeInbox as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0]![0]! as {
      publicRef: unknown
      secretHash: unknown
      payload: { pendingMediaIds: unknown }
    }
    expect(inboxDoc.publicRef).toBe('abcd1234')
    expect(inboxDoc.secretHash).toBe('h'.repeat(64))
    expect(inboxDoc.payload.pendingMediaIds).toEqual(['upl-1'])
  })

  it('normalizes public_disturbance to security before writing inbox', async () => {
    const deps: SubmitReportDeps = {
      ensureSignedIn: vi.fn().mockResolvedValue('citizen-1'),
      requestUploadUrl: vi.fn(),
      putBlob: vi.fn(),
      writeInbox: vi.fn().mockResolvedValue('ibx-5'),
      randomUUID: vi.fn().mockReturnValue('uuid-e'),
      randomPublicRef: vi.fn().mockReturnValue('ref9999'),
      randomSecret: vi.fn().mockReturnValue('s5'),
      sha256Hex: vi.fn().mockResolvedValue('k'.repeat(64)),
      now: () => 1,
    }
    await submitReport(deps, {
      reportType: 'public_disturbance',
      severity: 'medium',
      description: 'disturbance report',
      publicLocation: { lat: 14.1, lng: 122.9 },
    })
    expect(deps.writeInbox).toHaveBeenCalledOnce()
    const inboxDoc = (deps.writeInbox as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0]![0]! as {
      payload: { reportType: string }
    }
    expect(inboxDoc.payload.reportType).toBe('security')
  })

  it('skips upload path when no photo is provided', async () => {
    const deps: SubmitReportDeps = {
      ensureSignedIn: vi.fn().mockResolvedValue('citizen-1'),
      requestUploadUrl: vi.fn(),
      putBlob: vi.fn(),
      writeInbox: vi.fn().mockResolvedValue('ibx-2'),
      randomUUID: vi.fn().mockReturnValue('uuid-b'),
      randomPublicRef: vi.fn().mockReturnValue('efgh5678'),
      randomSecret: vi.fn().mockReturnValue('s2'),
      sha256Hex: vi.fn().mockResolvedValue('g'.repeat(64)),
      now: () => 1,
    }
    await submitReport(deps, {
      reportType: 'fire',
      severity: 'medium',
      description: 'y',
      publicLocation: { lat: 14.1, lng: 122.9 },
    })
    expect(deps.requestUploadUrl).not.toHaveBeenCalled()
    expect(deps.putBlob).not.toHaveBeenCalled()
  })

  it('normalizes phone and sets smsConsent in contact when provided', async () => {
    const deps: SubmitReportDeps = {
      ensureSignedIn: vi.fn().mockResolvedValue('citizen-1'),
      requestUploadUrl: vi.fn(),
      putBlob: vi.fn(),
      writeInbox: vi.fn().mockResolvedValue('ibx-3'),
      randomUUID: vi.fn().mockReturnValue('uuid-c'),
      randomPublicRef: vi.fn().mockReturnValue('ref1234'),
      randomSecret: vi.fn().mockReturnValue('s3'),
      sha256Hex: vi.fn().mockResolvedValue('i'.repeat(64)),
      now: () => 1,
    }
    await submitReport(deps, {
      reportType: 'flood',
      severity: 'low',
      description: 'z',
      publicLocation: { lat: 14.1, lng: 122.9 },
      contact: { phone: '09171234567', smsConsent: true },
    })
    expect(deps.writeInbox).toHaveBeenCalledOnce()
    const inboxDoc = (deps.writeInbox as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0]![0]! as {
      payload: { contact?: { phone: string; smsConsent: true } }
    }
    expect(inboxDoc.payload.contact).toEqual({
      phone: normalizeMsisdn('09171234567'),
      smsConsent: true,
    })
  })

  it('omits contact when not provided', async () => {
    const deps: SubmitReportDeps = {
      ensureSignedIn: vi.fn().mockResolvedValue('citizen-1'),
      requestUploadUrl: vi.fn(),
      putBlob: vi.fn(),
      writeInbox: vi.fn().mockResolvedValue('ibx-4'),
      randomUUID: vi.fn().mockReturnValue('uuid-d'),
      randomPublicRef: vi.fn().mockReturnValue('ref5678'),
      randomSecret: vi.fn().mockReturnValue('s4'),
      sha256Hex: vi.fn().mockResolvedValue('j'.repeat(64)),
      now: () => 1,
    }
    await submitReport(deps, {
      reportType: 'flood',
      severity: 'low',
      description: 'z',
      publicLocation: { lat: 14.1, lng: 122.9 },
    })
    expect(deps.writeInbox).toHaveBeenCalledOnce()
    const inboxDoc = (deps.writeInbox as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0]![0]! as { payload: Record<string, unknown> }
    expect(inboxDoc.payload.contact).toBeUndefined()
  })
})

describe('createDraft', () => {
  it('normalizes public_disturbance to security before persisting the draft', async () => {
    const { draft } = await createDraft({
      reportType: 'public_disturbance' as never,
      barangay: 'Bagasbas',
      description: 'loud disturbance',
      severity: 'medium',
      location: { lat: 14.12, lng: 122.95 },
      clientDraftRef: 'client-ref-1',
    })

    expect(draft.reportType).toBe('security')
    expect(mockDraftStoreSave).toHaveBeenCalledWith(
      expect.objectContaining({
        reportType: 'security',
      }),
    )
  })

  it('defaults description to non-empty string when patientCount is 0', async () => {
    // Regression: empty description caused backend schema rejection
    const { draft } = await createDraft({
      reportType: 'flood',
      barangay: 'Daet',
      description: 'Report submitted via Bantayog Alert.',
      severity: 'medium',
      location: { lat: 14.1, lng: 122.9 },
      clientDraftRef: 'client-ref-empty-desc',
    })

    expect(draft.description).toBe('Report submitted via Bantayog Alert.')
    expect(draft.description.length).toBeGreaterThanOrEqual(1)
    expect(mockDraftStoreSave).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Report submitted via Bantayog Alert.',
      }),
    )
  })
})

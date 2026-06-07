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

  it('writes triage details and nearest landmark into the inbox payload', async () => {
    const deps: SubmitReportDeps = {
      ensureSignedIn: vi.fn().mockResolvedValue('citizen-1'),
      requestUploadUrl: vi.fn(),
      putBlob: vi.fn(),
      writeInbox: vi.fn().mockResolvedValue('ibx-6'),
      randomUUID: vi.fn().mockReturnValue('uuid-f'),
      randomPublicRef: vi.fn().mockReturnValue('ref7777'),
      randomSecret: vi.fn().mockReturnValue('s6'),
      sha256Hex: vi.fn().mockResolvedValue('l'.repeat(64)),
      now: () => 1,
    }

    await submitReport(deps, {
      reportType: 'flood',
      severity: 'high',
      description: 'Water is entering houses near the creek.',
      publicLocation: { lat: 14.1, lng: 122.9 },
      municipalityId: 'daet',
      barangayId: 'bagasbas',
      nearestLandmark: 'Near the bridge',
      triage: {
        peopleInjured: true,
        peopleTrapped: false,
        locationConfidence: 'approximate',
        urgencyReason: 'Water is rising fast.',
      },
    })

    const inboxDoc = (deps.writeInbox as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0]![0]! as {
      payload: {
        description: string
        severity: string
        nearestLandmark?: string
        triage?: unknown
      }
    }
    expect(inboxDoc.payload.description).toBe('Water is entering houses near the creek.')
    expect(inboxDoc.payload.severity).toBe('high')
    expect(inboxDoc.payload.nearestLandmark).toBe('Near the bridge')
    expect(inboxDoc.payload.triage).toEqual({
      peopleInjured: true,
      peopleTrapped: false,
      locationConfidence: 'approximate',
      urgencyReason: 'Water is rising fast.',
    })
  })

  it('omits optional urgencyReason when it is not provided', async () => {
    const deps: SubmitReportDeps = {
      ensureSignedIn: vi.fn().mockResolvedValue('citizen-1'),
      requestUploadUrl: vi.fn(),
      putBlob: vi.fn(),
      writeInbox: vi.fn().mockResolvedValue('ibx-7'),
      randomUUID: vi.fn().mockReturnValue('uuid-g'),
      randomPublicRef: vi.fn().mockReturnValue('ref8888'),
      randomSecret: vi.fn().mockReturnValue('s7'),
      sha256Hex: vi.fn().mockResolvedValue('m'.repeat(64)),
      now: () => 1,
    }

    await submitReport(deps, {
      reportType: 'other',
      severity: 'low',
      description: 'A tree branch is blocking part of the road.',
      publicLocation: { lat: 14.1, lng: 122.9 },
      triage: {
        peopleInjured: false,
        peopleTrapped: false,
        locationConfidence: 'manual',
      },
    })

    const inboxDoc = (deps.writeInbox as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0]![0]! as {
      payload: { triage?: { urgencyReason?: string } }
    }
    expect(inboxDoc.payload.triage).toEqual({
      peopleInjured: false,
      peopleTrapped: false,
      locationConfidence: 'manual',
    })
    expect(inboxDoc.payload.triage?.urgencyReason).toBeUndefined()
  })

  it('omits whitespace-only urgencyReason after trimming', async () => {
    const deps: SubmitReportDeps = {
      ensureSignedIn: vi.fn().mockResolvedValue('citizen-1'),
      requestUploadUrl: vi.fn(),
      putBlob: vi.fn(),
      writeInbox: vi.fn().mockResolvedValue('ibx-8'),
      randomUUID: vi.fn().mockReturnValue('uuid-h'),
      randomPublicRef: vi.fn().mockReturnValue('ref9999'),
      randomSecret: vi.fn().mockReturnValue('s8'),
      sha256Hex: vi.fn().mockResolvedValue('o'.repeat(64)),
      now: () => 1,
    }

    await submitReport(deps, {
      reportType: 'flood',
      severity: 'medium',
      description: 'Water is entering houses near the creek.',
      publicLocation: { lat: 14.1, lng: 122.9 },
      triage: {
        peopleInjured: false,
        peopleTrapped: false,
        locationConfidence: 'approximate',
        urgencyReason: '   ',
      },
    })

    const inboxDoc = (deps.writeInbox as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0]![0]! as {
      payload: { triage?: { urgencyReason?: string } }
    }
    expect(inboxDoc.payload.triage).toEqual({
      peopleInjured: false,
      peopleTrapped: false,
      locationConfidence: 'approximate',
    })
    expect(inboxDoc.payload.triage?.urgencyReason).toBeUndefined()
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

  it('reuses draft idempotencyKey and correlationId when provided', async () => {
    const deps: SubmitReportDeps = {
      ensureSignedIn: vi.fn().mockResolvedValue('citizen-1'),
      requestUploadUrl: vi.fn(),
      putBlob: vi.fn(),
      writeInbox: vi.fn().mockResolvedValue('ibx-5'),
      randomUUID: vi.fn().mockReturnValue('should-not-be-used'),
      randomPublicRef: vi.fn().mockReturnValue('should-not-be-used'),
      randomSecret: vi.fn().mockReturnValue('should-not-be-used'),
      sha256Hex: vi.fn().mockResolvedValue('k'.repeat(64)),
      now: () => 9999,
    }
    const result = await submitReport(deps, {
      reportType: 'flood',
      severity: 'low',
      description: 'z',
      publicLocation: { lat: 14.1, lng: 122.9 },
      idempotencyKey: 'draft-key-123',
      publicRef: 'draft-ref',
      secret: 'draft-secret',
      correlationId: 'draft-corr-456',
      clientCreatedAt: 42,
    })
    expect(result.publicRef).toBe('draft-ref')
    expect(result.secret).toBe('draft-secret')
    expect(result.correlationId).toBe('draft-corr-456')
    expect(deps.randomUUID).not.toHaveBeenCalled()
    expect(deps.randomPublicRef).not.toHaveBeenCalled()
    expect(deps.randomSecret).not.toHaveBeenCalled()
    expect(deps.writeInbox).toHaveBeenCalledOnce()
    const inboxDoc = (deps.writeInbox as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0]![0]! as {
      idempotencyKey: string
      publicRef: string
      correlationId: string
      clientCreatedAt: number
    }
    expect(inboxDoc.idempotencyKey).toBe('draft-key-123')
    expect(inboxDoc.publicRef).toBe('draft-ref')
    expect(inboxDoc.correlationId).toBe('draft-corr-456')
    expect(inboxDoc.clientCreatedAt).toBe(42)
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

  it('persists triage details and location confidence in the draft', async () => {
    const { draft } = await createDraft({
      reportType: 'flood',
      barangay: 'Bagasbas',
      description: 'Water is rising beside the school.',
      severity: 'high',
      location: { lat: 14.12, lng: 122.95 },
      clientDraftRef: 'client-ref-triage',
      triage: {
        peopleInjured: true,
        peopleTrapped: true,
        locationConfidence: 'exact',
        urgencyReason: 'Residents are trapped upstairs.',
      },
    })

    expect(draft.triage).toEqual({
      peopleInjured: true,
      peopleTrapped: true,
      locationConfidence: 'exact',
      urgencyReason: 'Residents are trapped upstairs.',
    })
    expect(mockDraftStoreSave).toHaveBeenCalledWith(
      expect.objectContaining({
        triage: {
          peopleInjured: true,
          peopleTrapped: true,
          locationConfidence: 'exact',
          urgencyReason: 'Residents are trapped upstairs.',
        },
      }),
    )
  })

  it('preserves non-empty description passed to createDraft', async () => {
    const { draft } = await createDraft({
      reportType: 'flood',
      barangay: 'Daet',
      description: 'Report submitted via Bantayog Alert.',
      severity: 'medium',
      location: { lat: 14.1, lng: 122.9 },
      clientDraftRef: 'client-ref-desc-test',
    })

    expect(draft.description).toBe('Report submitted via Bantayog Alert.')
    expect(mockDraftStoreSave).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Report submitted via Bantayog Alert.',
      }),
    )
  })

  it('passes empty description through (caller must provide fallback before createDraft)', async () => {
    // createDraft is a pass-through for description; the fallback is applied
    // in SubmitReportForm before calling createDraft. This test documents that
    // behavior so future edits don't accidentally add transformation here.
    const { draft } = await createDraft({
      reportType: 'flood',
      barangay: 'Daet',
      description: '',
      severity: 'medium',
      location: { lat: 14.1, lng: 122.9 },
      clientDraftRef: 'client-ref-empty-desc',
    })

    expect(draft.description).toBe('')
    expect(mockDraftStoreSave).toHaveBeenCalledWith(
      expect.objectContaining({
        description: '',
      }),
    )
  })
})

import { describe, it, expect, vi } from 'vitest'
import { submitReport, type SubmitReportDeps } from './submit-report.js'

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
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(deps.requestUploadUrl).toHaveBeenCalledOnce()
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(deps.putBlob).toHaveBeenCalledWith('https://put.example', photo)
    // eslint-disable-next-line @typescript-eslint/unbound-method
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
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(deps.requestUploadUrl).not.toHaveBeenCalled()
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(deps.putBlob).not.toHaveBeenCalled()
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { onMediaFinalizeCore } from '../../triggers/on-media-finalize.js'

const mockFile = {
  download: vi.fn(),
  save: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  setMetadata: vi.fn().mockResolvedValue(undefined),
}

function bucket() {
  return {
    file: vi.fn(() => mockFile),
  }
}

beforeEach(() => {
  mockFile.download.mockReset()
  mockFile.save.mockReset().mockResolvedValue(undefined)
  mockFile.delete.mockReset().mockResolvedValue(undefined)
  mockFile.setMetadata.mockReset().mockResolvedValue(undefined)
})

describe('onMediaFinalizeCore', () => {
  it('rejects and deletes a non-image upload', async () => {
    mockFile.download.mockResolvedValue([Buffer.from('%PDF-1.4\n', 'utf8')])
    const writePending = vi.fn()
    const result = await onMediaFinalizeCore({
      bucket: bucket() as never,
      objectName: 'pending/abc',
      writePending,
    })
    expect(result.status).toBe('rejected_mime')
    expect(mockFile.delete).toHaveBeenCalled()
    expect(writePending).not.toHaveBeenCalled()
  })

  it('strips EXIF and writes pending_media record for a JPEG', async () => {
    const jpeg = Buffer.from(
      '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAB//2Q==',
      'base64',
    )
    mockFile.download.mockResolvedValue([jpeg])
    const writePending = vi.fn()
    const result = await onMediaFinalizeCore({
      bucket: bucket() as never,
      objectName: 'pending/upload-1',
      writePending,
    })
    expect(result.status).toBe('accepted')
    expect(writePending).toHaveBeenCalledTimes(1)
    expect(mockFile.save).toHaveBeenCalled()
  })
})

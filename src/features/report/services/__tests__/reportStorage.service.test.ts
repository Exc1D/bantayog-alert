import { describe, it, expect, vi } from 'vitest'
import { validatePhoto, PhotoValidationError, MAX_PHOTO_BYTES, ALLOWED_PHOTO_TYPES } from '../reportStorage.service'

vi.mock('@/app/firebase/config', () => ({
  storage: {},
  auth: {
    onAuthStateChanged: vi.fn((_auth, callback) => {
      callback(null)
      return vi.fn()
    }),
  },
  db: {},
}))

vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
}))

// Helper to construct a minimal File-like object for testing
// Vitest's fake File API is sufficient for size/type checks
function makeFile(overrides: Partial<{ size: number; type: string; name: string }> = {}): File {
  const defaults = { size: 1024, type: 'image/jpeg', name: 'test.jpg' }
  const opts = { ...defaults, ...overrides }
  return new File(['x'.repeat(opts.size)], opts.name, { type: opts.type })
}

describe('validatePhoto', () => {
  it('rejects a 6MB file with PHOTO_TOO_LARGE', () => {
    const file = makeFile({ size: 6 * 1024 * 1024 })
    expect(() => validatePhoto(file)).toThrow(PhotoValidationError)
    try {
      validatePhoto(file)
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(PhotoValidationError)
      expect((err as PhotoValidationError).code).toBe('PHOTO_TOO_LARGE')
    }
  })

  it('rejects an unsupported MIME type with PHOTO_INVALID_TYPE', () => {
    const file = makeFile({ type: 'application/x-evil' })
    expect(() => validatePhoto(file)).toThrow(PhotoValidationError)
    try {
      validatePhoto(file)
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(PhotoValidationError)
      expect((err as PhotoValidationError).code).toBe('PHOTO_INVALID_TYPE')
    }
  })

  it('accepts a valid JPEG file', () => {
    const file = makeFile({ size: 1024, type: 'image/jpeg' })
    expect(() => validatePhoto(file)).not.toThrow()
  })

  it('accepts a valid PNG file', () => {
    const file = makeFile({ size: 2048, type: 'image/png' })
    expect(() => validatePhoto(file)).not.toThrow()
  })

  it('accepts a valid WebP file', () => {
    const file = makeFile({ size: 3072, type: 'image/webp' })
    expect(() => validatePhoto(file)).not.toThrow()
  })

  it('accepts a file of exactly 5MB', () => {
    const file = makeFile({ size: MAX_PHOTO_BYTES })
    expect(() => validatePhoto(file)).not.toThrow()
  })

  it('rejects a file with empty MIME type', () => {
    const file = makeFile({ type: '' })
    expect(() => validatePhoto(file)).toThrow(PhotoValidationError)
    try {
      validatePhoto(file)
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(PhotoValidationError)
      expect((err as PhotoValidationError).code).toBe('PHOTO_INVALID_TYPE')
    }
  })

  it('PHOTO_TOO_LARGE message includes the size limit', () => {
    const file = makeFile({ size: 10 * 1024 * 1024 })
    try {
      validatePhoto(file)
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(PhotoValidationError)
      expect((err as PhotoValidationError).message).toContain('5MB')
    }
  })

  it('PHOTO_INVALID_TYPE message includes the actual MIME type', () => {
    const file = makeFile({ type: 'image/gif' })
    let thrownError: unknown
    try {
      validatePhoto(file)
    } catch (err: unknown) {
      thrownError = err
    }
    // Assert exception was thrown before checking its message
    expect(thrownError).toBeInstanceOf(PhotoValidationError)
    expect((thrownError as PhotoValidationError).message).toContain('image/gif')
  })
})

describe('constants', () => {
  it('MAX_PHOTO_BYTES equals 5MB', () => {
    expect(MAX_PHOTO_BYTES).toBe(5 * 1024 * 1024)
  })

  it('ALLOWED_PHOTO_TYPES includes jpeg, png, webp', () => {
    expect(ALLOWED_PHOTO_TYPES).toContain('image/jpeg')
    expect(ALLOWED_PHOTO_TYPES).toContain('image/png')
    expect(ALLOWED_PHOTO_TYPES).toContain('image/webp')
  })
})

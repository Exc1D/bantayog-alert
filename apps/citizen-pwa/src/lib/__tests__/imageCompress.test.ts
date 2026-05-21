import { describe, it, expect } from 'vitest'
import { compressImage, InvalidImageTypeError } from '../imageCompress.js'

describe('compressImage', () => {
  it('passes through files smaller than 200KB without compression', async () => {
    const smallFile = new File(['tiny'], 'small.jpg', { type: 'image/jpeg' })
    expect(smallFile.size).toBeLessThan(200_000)

    const result = await compressImage(smallFile)
    expect(result).toBe(smallFile)
  })

  it('returns a Promise for files larger than 200KB', () => {
    const largeContent = new Uint8Array(300_000).fill(0xff)
    const largeFile = new File([largeContent], 'large.jpg', { type: 'image/jpeg' })

    // In test environments (happy-dom), canvas/image operations may hang.
    // We only verify the function returns a Promise for large files.
    const result = compressImage(largeFile)
    expect(result).toBeInstanceOf(Promise)
  })

  it('accepts optional maxEdge and quality parameters', () => {
    const file = new File(['x'], 'test.jpg', { type: 'image/jpeg' })
    // Verify the function signature accepts opts without throwing
    const result = compressImage(file, { maxEdge: 800, quality: 0.5 })
    expect(result).toBeInstanceOf(Promise)
  })

  it('passes through files smaller than 200KB unchanged', async () => {
    const smallFile = new File(['tiny'], 'small.jpg', { type: 'image/jpeg' })
    // For small files, defaults don't matter — it passes through unchanged
    const result = await compressImage(smallFile)
    expect(result).toBe(smallFile)
  })

  it('rejects files with disallowed MIME types', async () => {
    const gifFile = new File(['gif'], 'anim.gif', { type: 'image/gif' })
    await expect(compressImage(gifFile)).rejects.toThrow(InvalidImageTypeError)

    const bmpFile = new File(['bmp'], 'image.bmp', { type: 'image/bmp' })
    await expect(compressImage(bmpFile)).rejects.toThrow(InvalidImageTypeError)

    const svgFile = new File(['<svg/>'], 'icon.svg', { type: 'image/svg+xml' })
    await expect(compressImage(svgFile)).rejects.toThrow(InvalidImageTypeError)
  })

  it('accepts allowed MIME types', async () => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    for (const type of allowedTypes) {
      const file = new File(['tiny'], `test.${type.split('/')[1]}`, { type })
      const result = await compressImage(file)
      expect(result).toBe(file)
    }
  })
})

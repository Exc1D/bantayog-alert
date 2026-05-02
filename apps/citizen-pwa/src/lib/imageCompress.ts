/**
 * Client-side image compression using canvas downscaling.
 * Skips compression for files under 200KB to avoid unnecessary re-encoding.
 * Falls back to the original file if canvas operations fail.
 */

async function compressImage(file: File, opts?: { maxEdge?: number; quality?: number }): Promise<Blob> {
  const { maxEdge = 1080, quality = 0.8 } = opts ?? {}

  // Already small — skip compression.
  if (file.size < 200_000) return file

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onerror = () => reject(new Error('Failed to load image'))
    img.onload = () => {
      URL.revokeObjectURL(img.src)

      let { width, height } = img
      if (width > maxEdge || height > maxEdge) {
        const ratio = Math.min(maxEdge / width, maxEdge / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas toBlob returned null'))
          } else {
            resolve(blob)
          }
        },
        'image/jpeg',
        quality,
      )
    }
    img.src = URL.createObjectURL(file)
  })
}

export { compressImage }

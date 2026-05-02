/**
 * Client-side image compression using canvas downscaling.
 * Skips compression for files under 200KB to avoid unnecessary re-encoding.
 * Falls back to the original file if canvas operations fail.
 */

async function compressImage(file: File, opts?: { maxEdge?: number; quality?: number }): Promise<Blob> {
  const { maxEdge = 1080, quality = 0.8 } = opts ?? {}

  // Already small — skip compression.
  if (file.size < 200_000) return file

  return new Promise((resolve) => {
    const img = new Image()
    let objectUrl: string | null = null

    img.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      resolve(file)
    }

    img.onload = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)

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
        resolve(file)
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file)
          } else {
            resolve(blob)
          }
        },
        'image/jpeg',
        quality,
      )
    }
    objectUrl = URL.createObjectURL(file)
    img.src = objectUrl
  })
}

export { compressImage }

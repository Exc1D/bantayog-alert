const TARGET_COMPRESSED_SIZE = 500_000
const SKIP_THRESHOLD = 200_000
const QUALITY_STEPS = [0.8, 0.65, 0.5] as const
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

export class InvalidImageTypeError extends Error {
  constructor(public readonly mimeType: string) {
    super(`Invalid image MIME type: ${mimeType}`)
    this.name = 'InvalidImageTypeError'
  }
}

export async function compressImage(
  file: File,
  opts?: { maxEdge?: number; quality?: number },
): Promise<Blob> {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new InvalidImageTypeError(file.type)
  }

  const { maxEdge = 1080 } = opts ?? {}

  if (file.size < SKIP_THRESHOLD) return file

  const img = await loadImage(file)
  if (!img) return file

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
  if (!ctx) return file
  ctx.drawImage(img, 0, 0, width, height)

  const qualities = opts?.quality != null ? [opts.quality] : QUALITY_STEPS

  for (const q of qualities) {
    const blob = await canvasToBlob(canvas, q)
    if (!blob) continue
    if (blob.size <= TARGET_COMPRESSED_SIZE) return blob
  }

  return (await canvasToBlob(canvas, 0.5)) ?? file
}

function loadImage(file: File): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

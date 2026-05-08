import { useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../app/firebase'

async function sha256Hex(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  const bytes = new Uint8Array(digest)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function useRequestUploadUrl() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | undefined>()

  async function upload(file: File): Promise<string | undefined> {
    setLoading(true)
    setError(undefined)
    const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
    const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      const err = new Error(
        `Invalid file type: ${file.type || 'unknown'}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
      )
      setError(err)
      setLoading(false)
      return undefined
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      const err = new Error(
        `File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB. Max: ${(MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(0)} MB`,
      )
      setError(err)
      setLoading(false)
      return undefined
    }
    try {
      const sha256 = await sha256Hex(file)
      const fn = httpsCallable<
        { mimeType: string; sizeBytes: number; sha256: string },
        { uploadUrl: string; uploadId: string; storagePath: string; expiresAt: number }
      >(functions, 'requestUploadUrl')
      const result = await fn({
        mimeType: file.type || 'image/jpeg',
        sizeBytes: file.size,
        sha256,
      })
      const { uploadUrl, storagePath } = result.data

      const response = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'image/jpeg' },
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${String(response.status)} ${response.statusText}`)
      }

      return storagePath
    } catch (err: unknown) {
      const normalized = err instanceof Error ? err : new Error(String(err))
      console.error('[useRequestUploadUrl] upload failed:', normalized)
      setError(normalized)
      throw normalized
    } finally {
      setLoading(false)
    }
  }

  return { upload, loading, error }
}

import sharp from 'sharp'
import { fileTypeFromBuffer } from 'file-type'
import { logDimension } from '@bantayog/shared-validators'

const log = logDimension('onMediaFinalize')

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])

export interface OnMediaFinalizeInput {
  bucket: { file(name: string): FileHandle }
  objectName: string
  writePending: (doc: {
    uploadId: string
    storagePath: string
    strippedAt: number
    mimeType: string
  }) => Promise<void>
}

export interface OnMediaFinalizeResult {
  status: 'accepted' | 'rejected_mime'
}

export async function onMediaFinalizeCore(
  input: OnMediaFinalizeInput,
): Promise<OnMediaFinalizeResult> {
  if (!input.objectName.startsWith('pending/')) {
    return { status: 'accepted' }
  }
  const file = (input.bucket as unknown as { file(name: string): FileHandle }).file(
    input.objectName,
  )
  const [buf] = await file.download()
  const ft = await fileTypeFromBuffer(buf)
  if (!ft || !ALLOWED.has(ft.mime)) {
    await file.delete()
    log({
      severity: 'WARNING',
      code: 'MEDIA_REJECTED_MIME',
      message: `Deleted non-image: ${input.objectName}`,
    })
    return { status: 'rejected_mime' }
  }
  const cleaned = await sharp(buf).rotate().toBuffer()
  await file.save(cleaned, {
    resumable: false,
    contentType: ft.mime,
    metadata: { cacheControl: 'private, no-transform' },
  } as object)
  const uploadId = input.objectName.slice('pending/'.length)
  await input.writePending({
    uploadId,
    storagePath: input.objectName,
    strippedAt: Date.now(),
    mimeType: ft.mime,
  })
  return { status: 'accepted' }
}

interface FileHandle {
  download(): Promise<[Buffer]>
  save(buf: Buffer, opts: object): Promise<void>
  delete(): Promise<void>
}

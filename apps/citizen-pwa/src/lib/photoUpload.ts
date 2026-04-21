import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'

export interface PhotoUploadResult {
  photoUrl: string
  storagePath: string
}

export type PhotoUploadState = 'idle' | 'uploading' | 'done' | 'error'

export interface PhotoUploadManager {
  state: PhotoUploadState
  photoUrl: string | null
  error: string | null
  uploadFile: File | null

  setState: (state: PhotoUploadState) => void
  setError: (error: string) => void
  uploadFile: (file: File) => void
}

export function createPhotoUploadManager(): PhotoUploadManager {
  let state: PhotoUploadState = 'idle'
  let photoUrl: string | null = null
  let error: string | null = null
  let uploadFile: File | null = null

  return {
    get state() {
      return state
    },
    get photoUrl() {
      return photoUrl
    },
    get error() {
      return error
    },

    setState(newState: PhotoUploadState) {
      state = newState
    },

    setError(err: string) {
      error = err
      state = 'error'
    },

    async uploadFile(file: File): Promise<void> {
      uploadFile = file
      state = 'uploading'
      error = null
      photoUrl = null

      try {
        const filename = `${Date.now()}-${file.name}`
        const storageRef = ref(getStorage(), `citizen-uploads/${filename}`)
        await uploadBytes(storageRef, file)
        photoUrl = await getDownloadURL(storageRef)
        state = 'done'
      } catch (err) {
        error = err instanceof Error ? err.message : 'Upload failed'
        state = 'error'
        throw err
      }
    },
  }
}

export async function uploadPhotoBlocking(file: File): Promise<PhotoUploadResult> {
  const manager = createPhotoUploadManager()

  if (manager.state === 'uploading') {
    throw new Error('Photo upload in progress')
  }

  await manager.uploadFile(file)

  if (manager.state !== 'done' || !manager.photoUrl) {
    throw new Error(manager.error || 'Upload failed')
  }

  return {
    photoUrl: manager.photoUrl,
    storagePath: `citizen-uploads/${Date.now()}-${file.name}`,
  }
}
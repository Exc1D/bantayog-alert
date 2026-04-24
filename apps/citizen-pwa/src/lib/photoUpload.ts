import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'

export interface PhotoUploadResult {
  photoUrl: string
  storagePath: string
}

export type PhotoUploadState = 'idle' | 'uploading' | 'done' | 'error'

export interface PhotoUploadManager {
  state: PhotoUploadState
  photoUrl: string | null
  storagePath: string | null
  error: string | null
  selectedFile: File | null

  setState: (state: PhotoUploadState) => void
  setError: (error: string) => void
  uploadFile: (file: File) => Promise<void>
}

export function createPhotoUploadManager(): PhotoUploadManager {
  let state: PhotoUploadState = 'idle'
  let photoUrl: string | null = null
  let storagePath: string | null = null
  let error: string | null = null
  let selectedFile: File | null = null

  return {
    get state() {
      return state
    },
    get photoUrl() {
      return photoUrl
    },
    get storagePath() {
      return storagePath
    },
    get error() {
      return error
    },
    get selectedFile() {
      return selectedFile
    },

    setState(newState: PhotoUploadState) {
      state = newState
    },

    setError(err: string) {
      error = err
      state = 'error'
    },

    async uploadFile(file: File): Promise<void> {
      selectedFile = file
      state = 'uploading'
      error = null
      photoUrl = null
      storagePath = null

      try {
        const filename = `${Date.now()}-${file.name}`
        storagePath = `citizen-uploads/${filename}`
        const storageRef = ref(getStorage(), storagePath)
        await uploadBytes(storageRef, file)
        photoUrl = await getDownloadURL(storageRef)
        state = 'done'
      } catch (err: unknown) {
        error = err instanceof Error ? err.message : 'Upload failed'
        state = 'error'
        throw err
      }
    },
  }
}

export async function uploadPhotoBlocking(file: File): Promise<PhotoUploadResult> {
  const manager = createPhotoUploadManager()

  await manager.uploadFile(file)

  if (manager.state !== 'done' || !manager.photoUrl) {
    throw new Error(manager.error || 'Upload failed')
  }

  return {
    photoUrl: manager.photoUrl,
    storagePath: manager.storagePath!,
  }
}
/**
 * Report Storage Service
 *
 * Handles file uploads to Firebase Storage for report photos.
 */

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '@/app/firebase/config'

/**
 * Upload a report photo to Firebase Storage
 *
 * @param file - The photo file to upload
 * @param reportId - The report ID to namespace the photo
 * @returns The download URL of the uploaded photo
 * @throws Error if upload fails
 */
export async function uploadReportPhoto(file: File, reportId: string): Promise<string> {
  try {
    // Create a unique filename: reportId_timestamp.ext
    const timestamp = Date.now()
    const extension = file.name.split('.').pop() || 'jpg'
    const filename = `${reportId}_${timestamp}.${extension}`

    const storageRef = ref(storage, `reports/${reportId}/${filename}`)

    // Upload the file
    const snapshot = await uploadBytes(storageRef, file)

    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref)

    return downloadURL
  } catch (error) {
    console.error('Failed to upload report photo:', error)
    throw new Error('Failed to upload report photo')
  }
}

/**
 * Upload multiple photos for a report
 *
 * @param files - Array of photo files to upload
 * @param reportId - The report ID to namespace the photos
 * @returns Array of download URLs
 */
export async function uploadReportPhotos(
  files: File[],
  reportId: string
): Promise<{ successful: string[]; failed: { file: File; error: string }[] }> {
  const results = await Promise.allSettled(
    files.map(async (file, index) => {
      const timestamp = Date.now()
      const extension = file.name.split('.').pop() || 'jpg'
      const filename = `${reportId}_${index}_${timestamp}.${extension}`

      const storageRef = ref(storage, `reports/${reportId}/${filename}`)
      const snapshot = await uploadBytes(storageRef, file)
      const downloadURL = await getDownloadURL(snapshot.ref)
      return downloadURL
    })
  )

  const successful: string[] = []
  const failed: { file: File; error: string }[] = []

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      successful.push(result.value)
    } else {
      const file = files[index]
      if (file) {
        failed.push({
          file,
          error: result.reason instanceof Error ? result.reason.message : 'Upload failed',
        })
      }
    }
  })

  return { successful, failed }
}

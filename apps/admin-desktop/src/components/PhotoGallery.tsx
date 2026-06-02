import { useRef, useState } from 'react'
import { updateDoc, doc } from 'firebase/firestore'
import { db } from '../app/firebase'

interface MediaItem {
  uploadId: string
  url: string
}

interface Props {
  reportId: string
  mediaUrls: MediaItem[]
  initialFeaturedIds: string[]
  onError: (message: string) => void
}

async function saveFeaturedMedia(
  reportId: string,
  selectedIds: string[],
  onError: (message: string) => void,
) {
  try {
    await updateDoc(doc(db, 'reports', reportId), {
      featuredMediaIds: selectedIds,
    })
  } catch (err) {
    onError(err instanceof Error ? err.message : 'Failed to save featured media')
  }
}

export function PhotoGallery({ reportId, mediaUrls, initialFeaturedIds, onError }: Props) {
  const [pendingIds, setPendingIds] = useState<string[]>(initialFeaturedIds)
  const writeQueues = useRef(new Map<string, Promise<void>>())

  if (mediaUrls.length === 0) return null

  return (
    <div className="col-span-full">
      <p className="mb-1 text-xs text-[var(--color-text-muted)]">Photos:</p>
      <div className="flex flex-wrap gap-2">
        {mediaUrls.map(({ uploadId, url }, idx) => {
          const isSelected = pendingIds.includes(uploadId)
          return (
            <label
              key={uploadId}
              className={`relative cursor-pointer overflow-hidden rounded border-2 ${
                isSelected ? 'border-[var(--color-success)]' : 'border-white/10'
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => {
                  const checked = e.target.checked
                  const next = checked
                    ? [...pendingIds, uploadId]
                    : pendingIds.filter((id) => id !== uploadId)
                  setPendingIds(next)

                  const prevWrite = writeQueues.current.get(reportId) ?? Promise.resolve()
                  const chained = prevWrite
                    .catch(() => undefined)
                    .then(() => saveFeaturedMedia(reportId, next, onError))
                  writeQueues.current.set(reportId, chained)
                }}
                className="absolute left-1 top-1 z-10"
                aria-label={`Select photo ${String(idx + 1)}`}
              />
              <span className="sr-only">
                Photo {String(idx + 1)} {isSelected ? '(selected)' : '(unselected)'}
              </span>
              <img src={url} alt="" className="h-[60px] w-[80px] object-cover" />
            </label>
          )
        })}
      </div>
    </div>
  )
}

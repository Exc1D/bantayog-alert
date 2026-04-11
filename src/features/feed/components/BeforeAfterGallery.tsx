/**
 * BeforeAfterGallery Component
 *
 * Displays before/after photos for resolved reports.
 * Allows users to compare the situation before and after response.
 *
 * @example
 * ```tsx
 * <BeforeAfterGallery
 *   photos={{
 *     before: ['https://example.com/before.jpg'],
 *     after: ['https://example.com/after.jpg']
 *   }}
 * />
 * ```
 */

import { useState } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

export interface BeforeAfterGalleryProps {
  photos: {
    before: string[]
    after: string[]
  }
}

export function BeforeAfterGallery({ photos }: BeforeAfterGalleryProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)

  // Don't render if no photos
  if (!photos.before.length && !photos.after.length) {
    return null
  }

  const allPhotos = [
    ...photos.before.map((url) => ({ url, section: 'before' as const })),
    ...photos.after.map((url) => ({ url, section: 'after' as const })),
  ]

  const currentIndex = selectedPhoto
    ? allPhotos.findIndex((p) => p.url === selectedPhoto)
    : -1

  const handlePrev = () => {
    if (currentIndex > 0) {
      setSelectedPhoto(allPhotos[currentIndex - 1].url)
    }
  }

  const handleNext = () => {
    if (currentIndex < allPhotos.length - 1) {
      setSelectedPhoto(allPhotos[currentIndex + 1].url)
    }
  }

  const handleClose = () => {
    setSelectedPhoto(null)
  }

  return (
    <div className="space-y-6">
      {/* Before Section */}
      {photos.before.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
            Before
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {photos.before.map((url, index) => (
              <button
                key={url}
                onClick={() => setSelectedPhoto(url)}
                data-testid={`before-photo-${index}`}
                className="relative aspect-square rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary-blue"
              >
                <img
                  src={url}
                  alt={`Before photo ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* After Section */}
      {photos.after.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
            After
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {photos.after.map((url, index) => (
              <button
                key={url}
                onClick={() => setSelectedPhoto(url)}
                data-testid={`after-photo-${index}`}
                className="relative aspect-square rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary-blue"
              >
                <img
                  src={url}
                  alt={`After photo ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Fullscreen Viewer */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black z-50 flex items-center justify-center"
          onClick={handleClose}
        >
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-lg"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>

          {currentIndex > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handlePrev()
              }}
              className="absolute left-4 p-2 text-white hover:bg-white/20 rounded-lg"
              aria-label="Previous"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}

          <img
            src={selectedPhoto}
            alt="Fullscreen photo"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {currentIndex < allPhotos.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleNext()
              }}
              className="absolute right-4 p-2 text-white hover:bg-white/20 rounded-lg"
              aria-label="Next"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
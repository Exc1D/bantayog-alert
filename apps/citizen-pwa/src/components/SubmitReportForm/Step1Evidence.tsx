import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Camera,
  Car,
  Flame,
  HelpCircle,
  Wind,
  Waves,
  BrickWall,
  MountainSnow,
  Megaphone,
  X,
} from 'lucide-react'
import { Button } from '../ui/Button'

const MAX_PHOTO_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

interface Step1EvidenceProps {
  onNext: (data: { reportType: string; photoFile: File | null }) => void
  onBack: () => void
  isSubmitting?: boolean
}

const INCIDENT_TYPES = [
  {
    value: 'flood',
    label: 'Flood',
    Icon: Waves,
    colorClass: 'text-info-500',
    selBorder: 'border-info-500',
    selBg: 'bg-info-500/10',
    selText: 'text-info-500',
  },
  {
    value: 'fire',
    label: 'Fire',
    Icon: Flame,
    colorClass: 'text-danger-500',
    selBorder: 'border-danger-500',
    selBg: 'bg-danger-500/10',
    selText: 'text-danger-500',
  },
  {
    value: 'accident',
    label: 'Accidents/Rescue',
    Icon: Car,
    colorClass: 'text-warning-500',
    selBorder: 'border-warning-500',
    selBg: 'bg-warning-500/10',
    selText: 'text-warning-500',
  },
  {
    value: 'typhoon',
    label: 'Typhoon',
    Icon: Wind,
    colorClass: 'text-warning-500',
    selBorder: 'border-warning-500',
    selBg: 'bg-warning-500/10',
    selText: 'text-warning-500',
  },
  {
    value: 'landslide',
    label: 'Landslide',
    Icon: MountainSnow,
    colorClass: 'text-surface-600',
    selBorder: 'border-surface-600',
    selBg: 'bg-surface-600/10',
    selText: 'text-surface-600',
  },
  {
    value: 'structural',
    label: 'Damages',
    Icon: BrickWall,
    colorClass: 'text-danger-500',
    selBorder: 'border-danger-500',
    selBg: 'bg-danger-500/10',
    selText: 'text-danger-500',
  },
  {
    value: 'public_disturbance',
    label: 'Public Disturbance',
    Icon: Megaphone,
    colorClass: 'text-warning-500',
    selBorder: 'border-warning-500',
    selBg: 'bg-warning-500/10',
    selText: 'text-warning-500',
  },
  {
    value: 'other',
    label: 'Others',
    Icon: HelpCircle,
    colorClass: 'text-surface-500',
    selBorder: 'border-surface-500',
    selBg: 'bg-surface-500/10',
    selText: 'text-surface-500',
  },
] as const

export function Step1Evidence({ onNext, onBack, isSubmitting = false }: Step1EvidenceProps) {
  const [reportType, setReportType] = useState('flood')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const canRenderCanvasPreview = typeof createImageBitmap === 'function'

  useEffect(() => {
    if (!photoFile || !canvasRef.current || !canRenderCanvasPreview) {
      return
    }

    let cancelled = false
    let bitmap: ImageBitmap | null = null
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    if (!context) {
      return
    }

    void createImageBitmap(photoFile)
      .then((nextBitmap) => {
        if (cancelled) {
          nextBitmap.close()
          return
        }

        bitmap = nextBitmap
        const width = 320
        const height = Math.max(1, Math.round((nextBitmap.height / nextBitmap.width) * width))
        canvas.width = width
        canvas.height = height
        context.clearRect(0, 0, width, height)
        context.drawImage(nextBitmap, 0, 0, width, height)
      })
      .catch(() => {
        context.clearRect(0, 0, canvas.width, canvas.height)
      })

    return () => {
      cancelled = true
      bitmap?.close()
      context.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [canRenderCanvasPreview, photoFile])

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    if (!file) {
      setPhotoFile(null)
      setPhotoError(null)
      return
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      setPhotoError('Please choose a JPG, PNG, or WebP photo.')
      setPhotoFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1)
      setPhotoError(`Photo is ${sizeMb} MB. Maximum size is 5 MB.`)
      setPhotoFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setPhotoError(null)
    setPhotoFile(file)
  }

  const handleNext = () => {
    onNext({ reportType, photoFile })
  }

  return (
    <div className="min-h-[100dvh] bg-surface-100 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-nav bg-surface-100/90 backdrop-blur-md border-b border-surface-200 px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="w-11 h-11 flex items-center justify-center rounded-full active:bg-surface-200 transition-colors"
        >
          <ArrowLeft size={24} className="text-surface-700" />
        </button>
        <h1 className="text-lg font-semibold text-surface-900 flex-1">Report Incident</h1>
        <span className="text-sm font-medium text-surface-400">Step 1 of 3</span>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 px-5 pt-4 pb-2">
        {[1, 2, 3].map((n) => {
          const isCompleted = 1 > n
          const isCurrent = 1 === n
          return (
            <div key={n} className="flex-1 flex items-center gap-2">
              <div
                className={`h-2 flex-1 rounded-full transition-colors duration-300 ${
                  isCompleted || isCurrent ? 'bg-brand-500' : 'bg-surface-200'
                } ${isCurrent ? 'animate-pulse' : ''}`}
              />
            </div>
          )
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-4 space-y-6">
        {/* Photo capture */}
        <div>
          <label
            htmlFor="photo-input"
            className="text-sm font-semibold text-surface-700 mb-2 block"
          >
            Photo Evidence
          </label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePhotoChange}
            aria-label="Upload photo"
            className="hidden"
            id="photo-input"
            ref={fileInputRef}
          />
          {!photoFile ? (
            <button
              type="button"
              onClick={() => document.getElementById('photo-input')?.click()}
              className="w-full h-40 rounded-xl border-2 border-dashed border-surface-300 flex flex-col items-center justify-center gap-2 active:bg-surface-50 transition-colors bg-white"
            >
              <Camera size={32} className="text-surface-400" />
              <span className="text-sm text-surface-400">Tap to add a photo</span>
              <span className="text-xs text-surface-300">Larawan ng insidente</span>
            </button>
          ) : (
            <div className="relative w-full h-40 rounded-xl overflow-hidden border border-surface-200 bg-white">
              {canRenderCanvasPreview ? (
                <canvas
                  ref={canvasRef}
                  aria-label="Photo preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <p className="text-sm text-surface-600">{photoFile.name}</p>
                  <p className="text-xs text-surface-400">Napili na ang larawan</p>
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setPhotoFile(null)
                  setPhotoError(null)
                  if (fileInputRef.current) {
                    fileInputRef.current.value = ''
                  }
                }}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-surface-900/60 flex items-center justify-center active:bg-surface-900/80 transition-colors"
                aria-label="Remove photo"
              >
                <X size={16} className="text-white" />
              </button>
            </div>
          )}
          {photoError && (
            <p role="alert" className="mt-2 text-xs text-danger-500 font-medium">
              {photoError}
            </p>
          )}
          {!photoFile && (
            <button
              type="button"
              onClick={handleNext}
              className="w-full text-center text-sm text-brand-500 font-medium mt-2 bg-transparent border-none cursor-pointer min-h-[44px] flex items-center justify-center"
            >
              Skip photo for now
            </button>
          )}
        </div>

        {/* Incident type grid */}
        <div>
          <p className="text-sm font-semibold text-surface-700 mb-3 block">Incident Type</p>
          <div className="grid grid-cols-2 gap-3">
            {INCIDENT_TYPES.map(({ value, label, Icon, colorClass, selBorder, selBg, selText }) => {
              const isSelected = reportType === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setReportType(value)
                  }}
                  className={`flex flex-col items-center justify-center gap-2 min-h-[80px] rounded-xl border-2 transition-all active:scale-95 ${
                    isSelected
                      ? `${selBorder} ${selBg} shadow-sm`
                      : 'border-surface-200 bg-white hover:border-surface-300'
                  }`}
                >
                  <Icon size={28} className={isSelected ? selText : colorClass} />
                  <span
                    className={`text-sm font-medium ${isSelected ? selText : 'text-surface-600'}`}
                  >
                    {label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Bottom action */}
      <div className="sticky bottom-0 z-float bg-surface-100/90 backdrop-blur-md border-t border-surface-200 px-5 py-4">
        <Button
          variant="primary"
          fullWidth
          onClick={handleNext}
          disabled={!reportType || isSubmitting}
        >
          {isSubmitting ? 'Please wait...' : 'Continue'}
        </Button>
      </div>
    </div>
  )
}

import { useState, useRef, useEffect } from 'react'
import {
  ArrowLeft,
  Camera,
  Droplets,
  Flame,
  Wind,
  Mountain,
  Waves,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '../ui/Button'

interface Step1EvidenceProps {
  onNext: (data: { reportType: string; photoFile: File | null }) => void
  onBack: () => void
  isSubmitting?: boolean
}

const INCIDENT_TYPES = [
  { value: 'flood', label: 'Flood', Icon: Droplets },
  { value: 'fire', label: 'Fire', Icon: Flame },
  { value: 'earthquake', label: 'Earthquake', Icon: AlertTriangle },
  { value: 'typhoon', label: 'Typhoon', Icon: Wind },
  { value: 'landslide', label: 'Landslide', Icon: Mountain },
  { value: 'storm_surge', label: 'Storm Surge', Icon: Waves },
] as const

export function Step1Evidence({ onNext, onBack, isSubmitting = false }: Step1EvidenceProps) {
  const [reportType, setReportType] = useState('flood')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const blobUrlRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [])

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setPhotoFile(file)
    if (file) {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
      }
      /* @extraction-note blob URL is a safe opaque reference, not DOM text */
      const blobUrl: string = URL.createObjectURL(file)
      blobUrlRef.current = blobUrl
      setPreviewUrl(blobUrl)
    }
  }

  const handleNext = () => {
    onNext({ reportType, photoFile })
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <button type="button" onClick={onBack} aria-label="Go back" className="back-btn">
          <ArrowLeft size={16} />
        </button>
        <span className="step-indicator">1 of 3</span>
      </div>

      <div className="progress-dots">
        <div className="progress-dot progress-dot--active" />
        <div className="progress-dot progress-dot--inactive" />
        <div className="progress-dot progress-dot--inactive" />
      </div>

      <h2 className="step-title">What&apos;s happening?</h2>
      <p className="step-subtitle">Add a photo and choose the type</p>

      <div className="camera-viewfinder">
        {previewUrl ? (
          /* @extraction-note blob URL from createObjectURL is a safe opaque reference, not DOM text */
          <img src={previewUrl} alt="Preview" className="preview-img" />
        ) : (
          <div className="camera-placeholder">
            <p className="camera-placeholder-text">Camera viewfinder</p>
            <div className="camera-circle" />
            <p className="camera-caption">Tap to capture</p>
          </div>
        )}
        <div className="camera-btn">
          <button
            type="button"
            onClick={() => document.getElementById('photo-input')?.click()}
            className="camera-capture-btn"
          >
            <Camera size={20} />
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          setPreviewUrl(null)
        }}
        className="no-photo-link"
      >
        No photo — continue without
      </button>
      <input
        id="photo-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handlePhotoChange}
        aria-label="Upload photo"
        className="hidden-file-input"
      />

      <div className="field-group">
        <p className="field-label">Type of incident</p>
        <div className="type-grid">
          {INCIDENT_TYPES.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setReportType(value)
              }}
              className={`type-btn${reportType === value ? ' type-btn--selected' : ''}`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <Button
        variant="primary"
        fullWidth
        onClick={handleNext}
        disabled={!reportType || isSubmitting}
      >
        {isSubmitting ? 'Please wait...' : 'Continue'}
      </Button>
    </div>
  )
}

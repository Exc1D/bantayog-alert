import { useState } from 'react'
import { Button } from '../ui/Button'

interface Step1EvidenceProps {
  onNext: (data: { reportType: string; photoFile: File | null }) => void
  onBack: () => void
  isSubmitting?: boolean
}

const INCIDENT_TYPES = [
  { value: 'flood', label: 'Flood', emoji: '🌊' },
  { value: 'fire', label: 'Fire', emoji: '🔥' },
  { value: 'road', label: 'Road', emoji: '🚧' },
  { value: 'medical', label: 'Medical', emoji: '🚑' },
  { value: 'power', label: 'Power', emoji: '⚡' },
  { value: 'landslide', label: 'Landslide', emoji: '⛰' },
  { value: 'other', label: 'Other', emoji: '+ Other' },
]

export function Step1Evidence({ onNext, onBack, isSubmitting = false }: Step1EvidenceProps) {
  const [reportType, setReportType] = useState('flood')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setPhotoFile(file)
    if (file) {
      setPreviewUrl(URL.createObjectURL(file))
    }
  }

  const handleNext = () => {
    onNext({ reportType, photoFile })
  }

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="w-8 h-8 rounded-full bg-[#f2f4f6] flex items-center justify-center text-[#001e40]"
        >
          ←
        </button>
        <span className="text-xs font-semibold text-[#43474f]">1 of 3</span>
      </div>

      <div className="flex gap-1 mb-4">
        <div className="flex-1 h-1 bg-[#001e40] rounded-full" />
        <div className="flex-1 h-1 bg-[#e0e3e5] rounded-full" />
        <div className="flex-1 h-1 bg-[#e0e3e5] rounded-full" />
      </div>

      <h2 className="text-xl font-bold text-[#001e40] mb-1">What&apos;s happening?</h2>
      <p className="text-xs text-[#43474f] mb-4">Add a photo and choose the type</p>

      <div className="bg-gradient-to-b from-[#032038] to-[#001e40] rounded-xl aspect-[4/5] relative overflow-hidden mb-3">
        {previewUrl ? (
          <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white">
              <p className="text-xs mb-2">Camera viewfinder</p>
              <div className="w-12 h-12 bg-white/20 rounded-full mx-auto mb-2" />
              <p className="text-[10px]">Tap to capture</p>
            </div>
          </div>
        )}
        <div className="absolute bottom-3 left-0 right-0 flex justify-center">
          <button
            type="button"
            onClick={() => document.getElementById('photo-input')?.click()}
            className="w-12 h-12 bg-white rounded-full flex items-center justify-center"
          >
            📸
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => document.getElementById('photo-input')?.click()}
        className="w-full text-center text-sm text-[#001e40] underline mb-4"
      >
        No photo available
      </button>
      <input
        id="photo-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handlePhotoChange}
        aria-label="Upload photo"
        className="hidden"
      />

      <div className="mb-4">
        <p className="text-xs font-bold text-[#001e40] uppercase tracking-wider mb-2">
          Type of incident
        </p>
        <div className="flex flex-wrap gap-1.5">
          {INCIDENT_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => {
                setReportType(type.value)
              }}
              className={`px-3 py-2 rounded-full text-xs font-semibold ${
                reportType === type.value
                  ? 'bg-[#001e40] text-white'
                  : 'bg-[#f2f4f6] text-[#191c1e]'
              }`}
            >
              {type.emoji} {type.label}
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

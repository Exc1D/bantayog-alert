import { useState } from 'react'
import {
  ArrowLeft,
  Heart,
  Car,
  Flame,
  HelpCircle,
  Wind,
  Waves,
  BrickWall,
  MountainSnow,
  Megaphone,
  AlertTriangle,
  MapPin,
  AlertCircle,
  Users,
  User,
  Pencil,
} from 'lucide-react'
import { Button } from '../ui/Button'

interface Step3ReviewProps {
  onBack: () => void
  onSubmit: () => void
  reportData: {
    reportType: string
    location: { lat: number; lng: number }
    reporterName: string
    reporterMsisdn: string
    patientCount: number
    locationMethod: 'gps' | 'manual'
    municipalityLabel?: string
    barangayId?: string
    nearestLandmark?: string
  }
  isSubmitting?: boolean
}

const INCIDENT_TYPES = [
  { value: 'flood', label: 'Flood', Icon: Waves },
  { value: 'fire', label: 'Fire', Icon: Flame },
  { value: 'accident', label: 'Accidents/Rescue', Icon: Car },
  { value: 'typhoon', label: 'Typhoon', Icon: Wind },
  { value: 'landslide', label: 'Landslide', Icon: MountainSnow },
  { value: 'structural', label: 'Damages', Icon: BrickWall },
  { value: 'public_disturbance', label: 'Public Disturbance', Icon: Megaphone },
  { value: 'other', label: 'Others', Icon: HelpCircle },
] as const

export function Step3Review({
  onBack,
  onSubmit,
  reportData,
  isSubmitting = false,
}: Step3ReviewProps) {
  const [consent, setConsent] = useState(false)

  const incident = INCIDENT_TYPES.find((t) => t.value === reportData.reportType)
  const Icon = incident?.Icon ?? AlertTriangle

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
        <h1 className="text-lg font-semibold text-surface-900 flex-1">Review Report</h1>
        <span className="text-sm font-medium text-surface-400">Step 3 of 3</span>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 px-5 pt-4 pb-2">
        {[1, 2, 3].map((n) => {
          const isCompleted = 3 > n
          const isCurrent = 3 === n
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
        {/* "We heard you" banner */}
        <div className="bg-brand-50 rounded-xl border border-brand-200 p-4 relative overflow-hidden">
          <div className="absolute -top-5 -right-5 w-20 h-20 rounded-full bg-brand-500/10" />
          <div className="flex gap-3 items-start relative">
            <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center shrink-0">
              <Heart size={16} className="text-white" />
            </div>
            <p className="text-sm text-surface-700 leading-relaxed">
              <strong className="text-surface-900">We heard you. We are here.</strong> Narinig namin
              kayo. Nandito kami. We&apos;ll notify you when help is on the way — please keep your
              phone line open.
            </p>
          </div>
        </div>

        {/* Summary card */}
        <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-surface-700">Report Summary</h2>
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 text-xs font-medium text-brand-500 min-h-[44px] px-1"
              aria-label="Edit report"
            >
              <Pencil size={12} />
              Edit
            </button>
          </div>

          <div className="divide-y divide-surface-100">
            {/* Type row */}
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Icon size={20} className="text-surface-400" />
                <div>
                  <p className="text-xs text-surface-400">Incident Type</p>
                  <p className="text-sm font-semibold text-surface-900">
                    {incident?.label ?? reportData.reportType}
                  </p>
                </div>
              </div>
            </div>

            {/* Patient count row */}
            {reportData.patientCount > 0 && (
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users size={20} className="text-surface-400" />
                  <div>
                    <p className="text-xs text-surface-400">Patients</p>
                    <p className="text-sm font-semibold text-surface-900">
                      {reportData.patientCount}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Location row */}
            <div className="px-4 py-3 flex items-start justify-between">
              <div className="flex items-start gap-3">
                <MapPin size={20} className="text-surface-400 mt-0.5" />
                <div>
                  <p className="text-xs text-surface-400">Location</p>
                  <p className="text-sm font-semibold text-surface-900">
                    {reportData.locationMethod === 'manual' && reportData.municipalityLabel
                      ? `${reportData.municipalityLabel}${reportData.barangayId ? `, ${reportData.barangayId}` : ''}`
                      : `${reportData.location.lat.toFixed(5)}, ${reportData.location.lng.toFixed(5)}`}
                  </p>
                  {reportData.nearestLandmark && (
                    <p className="text-xs text-surface-500 mt-0.5">{reportData.nearestLandmark}</p>
                  )}
                  <p className="text-xs text-surface-400 mt-0.5">
                    {reportData.locationMethod === 'gps' ? 'GPS coordinates' : 'Manual location'}
                  </p>
                </div>
              </div>
            </div>

            {/* Contact row */}
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <User size={20} className="text-surface-400" />
                <div>
                  <p className="text-xs text-surface-400">Contact</p>
                  <p className="text-sm font-semibold text-surface-900">
                    {reportData.reporterName}
                  </p>
                  <p className="text-xs text-surface-500">{reportData.reporterMsisdn}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Consent */}
        <div className="bg-brand-50 rounded-xl border border-brand-200 p-4">
          <label htmlFor="consent-checkbox" className="flex items-start gap-3 cursor-pointer">
            <div className="mt-0.5">
              <input
                id="consent-checkbox"
                name="consent"
                type="checkbox"
                checked={consent}
                onChange={(e) => {
                  setConsent(e.target.checked)
                }}
                className="w-5 h-5 rounded border-2 border-brand-300 text-brand-500 focus:ring-brand-500 accent-brand-500"
              />
            </div>
            <span className="text-sm text-surface-700 leading-relaxed">
              I confirm this report is accurate to the best of my knowledge. I consent to sharing
              this information with emergency responders.{' '}
              <em className="text-surface-500">Kumpirmo ko na totoo ang ulat na ito.</em>
            </span>
          </label>
        </div>

        {!consent && (
          <p className="text-xs text-surface-400 text-center flex items-center justify-center gap-1">
            <AlertCircle size={14} />
            Please check the consent box to submit
          </p>
        )}
      </div>

      {/* Bottom action */}
      <div className="sticky bottom-0 z-float bg-surface-100/90 backdrop-blur-md border-t border-surface-200 px-5 py-4">
        <Button
          variant="primary"
          fullWidth
          onClick={onSubmit}
          disabled={!consent || isSubmitting}
          className="!bg-danger-500 hover:!bg-danger-600 active:!bg-danger-600"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Sending...
            </span>
          ) : (
            'Submit Report'
          )}
        </Button>
      </div>
    </div>
  )
}

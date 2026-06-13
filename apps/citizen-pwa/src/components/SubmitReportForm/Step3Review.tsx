import { useState, useRef, type ComponentType } from 'react'
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
  Image,
  User,
  Pencil,
} from 'lucide-react'
import { Button } from '../ui/Button'
import { buildReportReadiness } from './report-readiness.js'

interface Step3ReviewProps {
  onBack: () => void
  onSubmit: () => void
  reportData: {
    reportType: string
    description: string
    peopleInjured: boolean
    peopleTrapped: boolean
    locationConfidence: 'exact' | 'approximate' | 'manual'
    urgencyReason?: string
    location: { lat: number; lng: number }
    reporterName: string
    reporterMsisdn: string
    locationMethod: 'gps' | 'manual'
    photoAttached: boolean
    municipalityLabel?: string
    barangayId?: string
    nearestLandmark?: string
  }
  isSubmitting?: boolean
}

type ReportData = Step3ReviewProps['reportData']
type IncidentType = (typeof INCIDENT_TYPES)[number]
type IconComponent = ComponentType<{ size?: number; className?: string }>

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

function Step3ReviewHeader({ onBack }: { onBack: () => void }) {
  return (
    <div className="sticky top-0 z-nav bg-surface-100/90 border-b border-surface-200 px-4 py-3 flex items-center gap-3">
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
  )
}

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2 px-5 pt-4 pb-2">
      {[1, 2, 3].map((n) => {
        const isCompleted = step > n
        const isCurrent = step === n
        return (
          <div key={n} className="flex-1 flex items-center gap-2">
            <div
              className={`h-2 flex-1 rounded-full transition-colors duration-300 ${
                isCompleted || isCurrent ? 'bg-brand-500' : 'bg-surface-200'
              } ${isCurrent ? 'motion-safe:animate-pulse' : ''}`}
            />
          </div>
        )
      })}
    </div>
  )
}

function SubmissionContextBanner() {
  return (
    <div className="bg-brand-50 rounded-xl border border-brand-200 p-4 relative overflow-hidden">
      <div className="flex gap-3 items-start relative">
        <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center shrink-0">
          <Heart size={16} className="text-white" />
        </div>
        <p className="text-sm text-surface-700 leading-relaxed">
          <strong className="text-surface-900">Your report will be reviewed.</strong> Keep your
          reference code after submitting. If there is immediate danger, call your local emergency
          hotline too.
        </p>
      </div>
    </div>
  )
}

function ReadinessCard({ readiness }: { readiness: ReturnType<typeof buildReportReadiness> }) {
  return (
    <section
      aria-label="Report readiness"
      className={`rounded-xl border px-4 py-3 ${
        readiness.level === 'needs-attention'
          ? 'border-warning-200 bg-warning-50'
          : 'border-brand-200 bg-white'
      }`}
    >
      <h2 className="text-sm font-semibold text-surface-900">Report readiness</h2>
      <div className="mt-2 space-y-2">
        {readiness.lines.map((line) => (
          <p key={line} className="text-sm leading-relaxed text-surface-700">
            {line}
          </p>
        ))}
      </div>
    </section>
  )
}

function locationConfidenceLabel(confidence: ReportData['locationConfidence']): string {
  return {
    exact: 'Exact spot',
    approximate: 'Approximate area',
    manual: 'Manual place only',
  }[confidence]
}

function manualLocationLabel(reportData: ReportData): string {
  if (reportData.municipalityLabel) {
    return `${reportData.municipalityLabel}${reportData.barangayId ? `, ${reportData.barangayId}` : ''}`
  }
  return `${reportData.location.lat.toFixed(5)}, ${reportData.location.lng.toFixed(5)}`
}

function SummaryHeader({ onBack }: { onBack: () => void }) {
  return (
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
  )
}

function SummaryIncidentRow({
  reportData,
  incident,
  Icon,
}: {
  reportData: ReportData
  incident: IncidentType | undefined
  Icon: IconComponent
}) {
  return (
    <div className="px-4 py-4 flex items-center justify-between">
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
  )
}

function SummaryWhatHappenedRow({ reportData }: { reportData: ReportData }) {
  return (
    <div className="px-4 py-4">
      <p className="text-xs text-surface-400">What happened</p>
      <p className="mt-1 text-sm font-semibold text-surface-900">{reportData.description}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-surface-50 px-3 py-2">
          <p className="text-xs text-surface-400">People injured</p>
          <p className="text-sm font-semibold text-surface-900">
            {reportData.peopleInjured ? 'Yes' : 'No'}
          </p>
        </div>
        <div className="rounded-lg bg-surface-50 px-3 py-2">
          <p className="text-xs text-surface-400">People trapped</p>
          <p className="text-sm font-semibold text-surface-900">
            {reportData.peopleTrapped ? 'Yes' : 'No'}
          </p>
        </div>
      </div>
      {reportData.urgencyReason && (
        <p className="mt-2 text-xs text-surface-500">{reportData.urgencyReason}</p>
      )}
    </div>
  )
}

function SummaryLocationRow({ reportData }: { reportData: ReportData }) {
  return (
    <div className="px-4 py-4 flex items-start justify-between">
      <div className="flex items-start gap-3">
        <MapPin size={20} className="text-surface-400 mt-0.5" />
        <div>
          <p className="text-xs text-surface-400">Location</p>
          <p className="text-sm font-semibold text-surface-900">
            {reportData.locationMethod === 'manual'
              ? manualLocationLabel(reportData)
              : `${reportData.location.lat.toFixed(5)}, ${reportData.location.lng.toFixed(5)}`}
          </p>
          {reportData.nearestLandmark && (
            <p className="text-xs text-surface-500 mt-0.5">{reportData.nearestLandmark}</p>
          )}
          <p className="text-xs text-surface-400 mt-0.5">
            {reportData.locationMethod === 'gps' ? 'GPS coordinates' : 'Manual location'}
          </p>
          <p className="text-xs text-surface-500 mt-0.5">
            Confidence: {locationConfidenceLabel(reportData.locationConfidence)}
          </p>
        </div>
      </div>
    </div>
  )
}

function SummaryPhotoRow({ reportData }: { reportData: ReportData }) {
  return (
    <div className="px-4 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Image size={20} className="text-surface-400" />
        <div>
          <p className="text-xs text-surface-400">Photo</p>
          <p className="text-sm font-semibold text-surface-900">
            {reportData.photoAttached ? 'Attached' : 'Not attached'}
          </p>
        </div>
      </div>
    </div>
  )
}

function SummaryContactRow({ reportData }: { reportData: ReportData }) {
  return (
    <div className="px-4 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <User size={20} className="text-surface-400" />
        <div>
          <p className="text-xs text-surface-400">Contact</p>
          <p className="text-sm font-semibold text-surface-900">{reportData.reporterName}</p>
          <p className="text-xs text-surface-500">{reportData.reporterMsisdn}</p>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({
  reportData,
  incident,
  Icon,
  onBack,
}: {
  reportData: ReportData
  incident: IncidentType | undefined
  Icon: IconComponent
  onBack: () => void
}) {
  return (
    <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
      <SummaryHeader onBack={onBack} />
      <div className="divide-y divide-surface-100">
        <SummaryIncidentRow reportData={reportData} incident={incident} Icon={Icon} />
        <SummaryWhatHappenedRow reportData={reportData} />
        <SummaryLocationRow reportData={reportData} />
        <SummaryPhotoRow reportData={reportData} />
        <SummaryContactRow reportData={reportData} />
      </div>
    </div>
  )
}

function SubmitActions({
  consent,
  hasConfirmed,
  isSubmitting,
  onConsentChange,
  onConfirmChange,
  onSubmit,
}: {
  consent: boolean
  hasConfirmed: boolean
  isSubmitting: boolean
  onConsentChange: (checked: boolean) => void
  onConfirmChange: (checked: boolean) => void
  onSubmit: () => void
}) {
  return (
    <div className="sticky bottom-0 z-float bg-surface-100/90 border-t border-surface-200 px-5 py-4 space-y-3">
      <label htmlFor="consent-checkbox-bottom" className="flex items-start gap-3 cursor-pointer">
        <div className="mt-0.5">
          <input
            id="consent-checkbox-bottom"
            name="consent"
            type="checkbox"
            checked={consent}
            onChange={(event) => {
              onConsentChange(event.currentTarget.checked)
            }}
            className="w-5 h-5 rounded border-2 border-brand-300 text-brand-500 focus:ring-brand-500 accent-brand-500"
          />
        </div>
        <span className="text-sm text-surface-700 leading-relaxed">
          I confirm this report is accurate to the best of my knowledge. I consent to sharing this
          information with emergency responders.{' '}
          <em className="text-surface-500">Kumpirmo ko na totoo ang ulat na ito.</em>
        </span>
      </label>

      {consent && (
        <div className="bg-warning-50 border border-warning-200 rounded-xl p-4 flex gap-3 items-start">
          <AlertCircle size={24} className="text-warning-600 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-surface-900 m-0">
              Are you sure this is a real emergency?
            </h2>
            <p className="text-sm text-surface-700 m-0">
              False reports delay help for people who truly need it and may carry penalties under
              Philippine law.
            </p>
            <p className="text-sm text-surface-600 italic m-0">
              Ang maling ulat ay nakakaantala ng tulong sa mga tunay na nangangailangan.
            </p>
            <label className="flex items-start gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={hasConfirmed}
                onChange={(event) => {
                  onConfirmChange(event.currentTarget.checked)
                }}
                className="w-4 h-4 rounded border-2 border-warning-300 text-brand-500 focus:ring-brand-500 accent-brand-500 mt-0.5"
              />
              <span className="text-sm text-surface-700">
                Yes, this is a real emergency. I understand false reports delay help for others.
              </span>
            </label>
          </div>
        </div>
      )}

      <Button
        variant="primary"
        fullWidth
        onClick={onSubmit}
        disabled={!consent || !hasConfirmed || isSubmitting}
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
  )
}

export function Step3Review({
  onBack,
  onSubmit,
  reportData,
  isSubmitting = false,
}: Step3ReviewProps) {
  const [consent, setConsent] = useState(false)
  const [hasConfirmed, setHasConfirmed] = useState(false)
  const hasSubmittedRef = useRef(false)

  const incident = INCIDENT_TYPES.find((t) => t.value === reportData.reportType)
  const Icon = incident?.Icon ?? AlertTriangle
  const readiness = buildReportReadiness(reportData)

  const handleSubmit = () => {
    if (!consent || !hasConfirmed || hasSubmittedRef.current) return
    hasSubmittedRef.current = true
    onSubmit()
  }

  return (
    <div className="min-h-[100dvh] bg-surface-100 flex flex-col">
      <Step3ReviewHeader onBack={onBack} />
      <StepIndicator step={3} />

      <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-4 space-y-6">
        <SubmissionContextBanner />
        <ReadinessCard readiness={readiness} />
        <SummaryCard reportData={reportData} incident={incident} Icon={Icon} onBack={onBack} />
      </div>

      <SubmitActions
        consent={consent}
        hasConfirmed={hasConfirmed}
        isSubmitting={isSubmitting}
        onConsentChange={setConsent}
        onConfirmChange={setHasConfirmed}
        onSubmit={handleSubmit}
      />
    </div>
  )
}

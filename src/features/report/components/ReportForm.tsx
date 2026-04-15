import React, { useRef, useState } from 'react'
import {
  AlertCircle,
  WifiOff,
  Droplets,
  Mountain,
  Flame,
  Wind,
  Heart,
  Car,
  Building,
  AlertTriangle,
  MoreHorizontal,
} from 'lucide-react'
import { ReportSuccess } from './ReportSuccess'
import { NonEmergencyRedirect } from './NonEmergencyRedirect'
import { RateLimitExceeded } from './RateLimitExceeded'
import { useReportQueue } from '../hooks/useReportQueue'
import { useDuplicateCheck } from '../hooks/useDuplicateCheck'
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus'
import { useGeolocation } from '@/shared/hooks/useGeolocation'
import { isValidPHCoordinate } from '@/shared/utils/geoValidation'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportData {
  incidentType: IncidentType
  photo: File | null
  location: LocationValue
  phone: string
  isAnonymous: boolean
  injuriesConfirmed?: boolean
  situationWorsening?: boolean
}

type IncidentType =
  | 'flood'
  | 'earthquake'
  | 'landslide'
  | 'fire'
  | 'typhoon'
  | 'medical_emergency'
  | 'accident'
  | 'infrastructure'
  | 'crime'
  | 'other'

type LocationValue =
  | { type: 'gps'; latitude: number; longitude: number }
  | { type: 'manual'; municipality: string; barangay: string }

interface ReportFormProps {
  userLocation?: { latitude: number; longitude: number }
  gpsError?: string
  onSubmit?: (data: ReportData) => void
  onCreateAccount?: () => void
  onShare?: (reportId: string) => void
  onNavigate?: () => void
}

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

const INCIDENT_TYPES: { value: IncidentType; label: string; icon: React.ReactNode }[] = [
  { value: 'flood', label: 'Flood', icon: <Droplets size={18} /> },
  { value: 'earthquake', label: 'Earthquake', icon: <Mountain size={18} /> },
  { value: 'landslide', label: 'Landslide', icon: <Mountain size={18} /> },
  { value: 'fire', label: 'Fire', icon: <Flame size={18} /> },
  { value: 'typhoon', label: 'Typhoon', icon: <Wind size={18} /> },
  { value: 'medical_emergency', label: 'Medical Emergency', icon: <Heart size={18} /> },
  { value: 'accident', label: 'Accident', icon: <Car size={18} /> },
  { value: 'infrastructure', label: 'Infrastructure Issue', icon: <Building size={18} /> },
  { value: 'crime', label: 'Crime', icon: <AlertTriangle size={18} /> },
  { value: 'other', label: 'Other Issues', icon: <MoreHorizontal size={18} /> },
]

const MUNICIPALITIES = ['Daet', 'Capalonga', 'Jose Panganiban', 'Labo']

const BARANGAYS: Record<string, string[]> = {
  Daet: ['Bagasbas', 'Camambugan', 'Lag-on', 'San Isidro', 'Tagkawayan'],
  Capalonga: ['Barcelonita', 'Gahonon', 'Mabini', 'Santa Elena'],
  'Jose Panganiban': ['Calauag', 'Dahican', 'Napaod', 'Plaridel'],
  Labo: ['Anahaw', 'Cabusay', 'Calagnatuan', 'Matanlang'],
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

// Philippine mobile format: +63 followed by 10 digits (spaces optional)
const PH_PHONE_REGEX = /^\+63\s?\d{3}\s?\d{3}\s?\d{4}$/

function validatePhone(value: string): string | null {
  if (!value.trim()) return 'Phone number is required'
  if (!PH_PHONE_REGEX.test(value.trim())) {
    return 'Phone must be in format: +63 912 345 6789'
  }
  return null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReportForm({
  userLocation,
  gpsError,
  onSubmit,
  onCreateAccount,
  onShare,
  onNavigate,
}: ReportFormProps) {
  // incidentType must be declared before useDuplicateCheck since the hook reads it
  const [incidentType, setIncidentType] = useState<IncidentType>('other')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [municipality, setMunicipality] = useState('')
  const [barangay, setBarangay] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [injuriesConfirmed, setInjuriesConfirmed] = useState<boolean | undefined>(undefined)
  const [situationWorsening, setSituationWorsening] = useState<boolean | undefined>(undefined)
  const [submittedReportId, setSubmittedReportId] = useState<string | null>(null)
  const [showNonEmergency, setShowNonEmergency] = useState(false)
  const [rateLimitExceeded, setRateLimitExceeded] = useState(false)
  const [privacyConsent, setPrivacyConsent] = useState(false)
  const [privacyConsentError, setPrivacyConsentError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const { enqueueReport } = useReportQueue()
  const { isOnline } = useNetworkStatus()
  const geo = useGeolocation()

  const resolvedUserLocation = userLocation ?? geo.coordinates ?? undefined
  const resolvedGpsError = gpsError ?? (geo.loading ? undefined : (geo.error ?? undefined))

  // Duplicate check — only meaningful when GPS location is available
  const { duplicates } = useDuplicateCheck(
    resolvedUserLocation && !resolvedGpsError
      ? {
          latitude: resolvedUserLocation.latitude,
          longitude: resolvedUserLocation.longitude,
          incidentType,
        }
      : { latitude: 0, longitude: 0, incidentType: '' }
  )

  const isGpsAvailable = Boolean(resolvedUserLocation && !resolvedGpsError)
  const showManualDropdowns = Boolean(resolvedGpsError)

  function handlePhotoButtonClick() {
    fileInputRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    try {
      const files = e.target.files
      if (!files || files.length === 0) {
        // User cancelled file selection — clear photo
        setPhoto(null)
        setPhotoError(null)
        return
      }
      setPhoto(files[0] ?? null)
      setPhotoError(null)
    } catch (err: unknown) {
      // File access errors (SecurityError, NotAllowedError, AbortError) land here
      console.error('[FILE_ACCESS_ERROR]', err instanceof Error ? err.message : err)
      setPhotoError('Unable to access file. Please try again.')
    }
  }

  function handlePhoneBlur() {
    setPhoneError(validatePhone(phone))
  }

  function handleMunicipalityChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setMunicipality(e.target.value)
    setBarangay('') // reset barangay when municipality changes
    setLocationError(null) // clear any previous location error
  }

  function generateReportId(location: LocationValue): string {
    const year = new Date().getFullYear()
    const municipalityCode =
      location.type === 'manual' && location.municipality
        ? location.municipality.substring(0, 4).toUpperCase()
        : 'DAET'
    const sequential = Math.floor(Math.random() * 9000) + 1000
    return `${year}-${municipalityCode}-${sequential}`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // DPA compliance: explicit consent required before collecting personal data
    if (!privacyConsent) {
      setPrivacyConsentError('You must agree to the Privacy Policy to submit a report.')
      return
    }

    // Validate photo is required
    if (!photo) {
      setPhotoError('Photo is required')
      return
    }

    // Re-validate phone before submission
    const phoneError = validatePhone(phone)
    if (phoneError) {
      setPhoneError(phoneError)
      return
    }

    // Validate manual location dropdowns when GPS is unavailable
    if (!isGpsAvailable && (!municipality || !barangay)) {
      setLocationError('Please select municipality and barangay')
      return
    }

    // Reject invalid GPS coordinates — guards against (0,0) null-island and out-of-range values
    if (resolvedUserLocation) {
      const { latitude, longitude } = resolvedUserLocation
      if (!isValidPHCoordinate(latitude, longitude)) {
        setLocationError('Invalid GPS coordinates. Please select municipality manually.')
        return
      }
    }

    const location: LocationValue = isGpsAvailable
      ? {
          type: 'gps',
          latitude: resolvedUserLocation!.latitude,
          longitude: resolvedUserLocation!.longitude,
        }
      : { type: 'manual', municipality, barangay }

    const reportData = {
      incidentType,
      photo,
      location,
      phone,
      isAnonymous,
      injuriesConfirmed,
      situationWorsening,
    }

    // If offline, enqueue the report
    if (!isOnline) {
      enqueueReport(reportData)
      // Notify parent even when offline — parent may track analytics or state
      try {
        onSubmit?.(reportData)
      } catch {
        // Parent error must not block offline queue flow
      }
      // Show queued success screen (different from immediate submission)
      const reportId = generateReportId(location)
      setSubmittedReportId(`${reportId}-queued`)
      return
    }

    // Online: call the persistence service and wait for the confirmed reportId
    try {
      const persistedReportId = await onSubmit?.(reportData)
      const idStr = typeof persistedReportId === 'string' ? persistedReportId : ''
      setSubmittedReportId(idStr.length > 0 ? idStr : generateReportId(location))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit report'
      setPhotoError(message)
    }
  }

  function handleShare() {
    if (submittedReportId) {
      onShare?.(submittedReportId)
    }
  }

  // Get municipality for success screen
  const getMunicipalityName = (): string => {
    if (municipality) return municipality
    if (isGpsAvailable) return 'Daet' // Default for GPS
    return 'Unknown'
  }

  // Derive a human-readable GPS label for display
  const gpsLabel = isGpsAvailable
    ? `GPS: ${resolvedUserLocation!.latitude.toFixed(4)}, ${resolvedUserLocation!.longitude.toFixed(4)}`
    : null

  const availableBarangays = municipality ? (BARANGAYS[municipality] ?? []) : []

  // Show non-emergency redirect screen
  if (showNonEmergency) {
    return (
      <NonEmergencyRedirect
        municipality={municipality || 'Daet'}
        municipalHallPhone="+63 54 100 1234"
        mdrmoPhone="+63 54 100 5678"
        barangayCaptainPhone="+63 54 100 9012"
        onCancel={() => setShowNonEmergency(false)}
      />
    )
  }

  // Show rate limit exceeded screen
  if (rateLimitExceeded) {
    return (
      <RateLimitExceeded
        mdrmoHotline="+63 54 123 4567"
        retryAfterMinutes={60}
        onOk={() => setRateLimitExceeded(false)}
      />
    )
  }

  // Show success screen if form was submitted
  if (submittedReportId) {
    const isQueued = submittedReportId.endsWith('-queued')
    return (
      <ReportSuccess
        reportId={submittedReportId}
        municipality={getMunicipalityName()}
        isQueued={isQueued}
        onCreateAccount={onCreateAccount}
        onShare={handleShare}
        onNavigate={onNavigate}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-lg mx-auto bg-white min-h-screen">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
          <h1 className="text-xl font-bold text-gray-900">Submit Report</h1>
          <p className="text-sm text-gray-500 mt-1">Report a disaster or emergency in your area</p>
        </div>

        {/* Duplicate warning */}
        {duplicates.length > 0 && (
          <div
            className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 mx-4 mt-4"
            data-testid="duplicate-warning"
            role="alert"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-900">Possible duplicate detected</p>
                <p className="text-xs text-amber-700 mt-1">
                  {duplicates.length === 1
                    ? 'A similar report was submitted nearby in the last 30 minutes. Please verify this is not a duplicate before submitting.'
                    : `${duplicates.length} similar reports were submitted nearby in the last 30 minutes. Please verify these are not duplicates before submitting.`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Offline indicator */}
        {!isOnline && (
          <div
            className="bg-orange-50 border-b border-orange-200 px-4 py-3 flex items-center gap-2"
            data-testid="offline-banner"
          >
            <WifiOff className="w-5 h-5 text-orange-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-orange-900">You're offline</p>
              <p className="text-xs text-orange-700">
                Your report will be queued and submitted automatically when you're back online.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="p-4 space-y-6">
          {/* ------------------------------------------------------------------ */}
          {/* Photo field                                                          */}
          {/* ------------------------------------------------------------------ */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <label htmlFor="report-photo" className="block text-sm font-medium text-gray-700 mb-3">
              Photo <span className="text-red-500">*</span>
            </label>
            {/* Hidden file input associated with the visible label */}
            <input
              id="report-photo"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                handleFileChange(e)
                setPhotoError(null)
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={handlePhotoButtonClick}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg text-gray-600 hover:border-primary-blue hover:text-primary-blue transition-colors ${photoError ? 'border-red-500' : 'border-gray-300'}`}
            >
              <span>{photo ? photo.name : 'Tap to take a photo'}</span>
            </button>
            {photoError && <p className="text-red-500 text-sm mt-2">{photoError}</p>}
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* Incident Type field                                                   */}
          {/* ------------------------------------------------------------------ */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <label
              htmlFor="report-incident-type"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              What's happening? <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                id="report-incident-type"
                value={incidentType}
                onChange={(e) => setIncidentType(e.target.value as IncidentType)}
                required
                aria-label="Select incident type"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-blue focus:border-primary-blue bg-white text-gray-900 appearance-none cursor-pointer"
              >
                {INCIDENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                {INCIDENT_TYPES.find((t) => t.value === incidentType)?.icon}
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* Location field                                                       */}
          {/* ------------------------------------------------------------------ */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Location <span className="text-red-500">*</span>
            </label>

            {isGpsAvailable && (
              <div
                id="report-location"
                data-testid="location-display"
                className="flex items-center gap-2 text-sm text-gray-600"
              >
                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{gpsLabel}</span>
              </div>
            )}

            {showManualDropdowns && (
              <div id="report-location" data-testid="location-display" className="space-y-3">
                <div>
                  <label htmlFor="report-municipality" className="block text-xs text-gray-500 mb-1">
                    Municipality
                  </label>
                  <select
                    id="report-municipality"
                    value={municipality}
                    onChange={handleMunicipalityChange}
                    aria-label="Select Municipality"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-blue focus:border-primary-blue bg-white text-gray-900"
                  >
                    <option value="">-- Select Municipality --</option>
                    {MUNICIPALITIES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="report-barangay" className="block text-xs text-gray-500 mb-1">
                    Barangay
                  </label>
                  <select
                    id="report-barangay"
                    value={barangay}
                    onChange={(e) => {
                      setBarangay(e.target.value)
                      setLocationError(null)
                    }}
                    disabled={!municipality}
                    aria-label="Select Barangay"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-blue focus:border-primary-blue bg-white text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    <option value="">-- Select Barangay --</option>
                    {availableBarangays.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                {locationError && (
                  <p role="alert" className="text-red-500 text-sm mt-1">
                    {locationError}
                  </p>
                )}
              </div>
            )}

            {!isGpsAvailable && !showManualDropdowns && (
              <div
                id="report-location"
                data-testid="location-display"
                className="text-sm text-gray-500"
              >
                Detecting location…
              </div>
            )}
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* Quick questions                                                      */}
          {/* ------------------------------------------------------------------ */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
            <p className="text-sm font-medium text-gray-700">Quick Questions (Optional)</p>

            {/* Anyone injured? */}
            <div className="flex flex-col gap-2">
              <span className="text-sm text-gray-600">
                Anyone injured? <span className="text-gray-500">(May nasaktan ba?)</span>
              </span>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="injuries"
                    checked={injuriesConfirmed === true}
                    onChange={() => setInjuriesConfirmed(true)}
                    className="w-4 h-4 text-primary-blue"
                  />
                  <span className="text-sm text-gray-700">Yes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="injuries"
                    checked={injuriesConfirmed === false}
                    onChange={() => setInjuriesConfirmed(false)}
                    className="w-4 h-4 text-primary-blue"
                  />
                  <span className="text-sm text-gray-700">No</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="injuries"
                    checked={injuriesConfirmed === undefined}
                    onChange={() => setInjuriesConfirmed(undefined)}
                    className="w-4 h-4 text-primary-blue"
                  />
                  <span className="text-sm text-gray-500">Skip</span>
                </label>
              </div>
            </div>

            {/* Situation getting worse? */}
            <div className="flex flex-col gap-2">
              <span className="text-sm text-gray-600">
                Is the situation getting worse?{' '}
                <span className="text-gray-500">(Lumalala ba ang sitwasyon?)</span>
              </span>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="worsening"
                    checked={situationWorsening === true}
                    onChange={() => setSituationWorsening(true)}
                    className="w-4 h-4 text-primary-blue"
                  />
                  <span className="text-sm text-gray-700">Yes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="worsening"
                    checked={situationWorsening === false}
                    onChange={() => setSituationWorsening(false)}
                    className="w-4 h-4 text-primary-blue"
                  />
                  <span className="text-sm text-gray-700">No</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="worsening"
                    checked={situationWorsening === undefined}
                    onChange={() => setSituationWorsening(undefined)}
                    className="w-4 h-4 text-primary-blue"
                  />
                  <span className="text-sm text-gray-500">Skip</span>
                </label>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* Phone field                                                          */}
          {/* ------------------------------------------------------------------ */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <label htmlFor="report-phone" className="block text-sm font-medium text-gray-700 mb-2">
              Phone <span className="text-red-500">*</span>
            </label>
            <input
              id="report-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={handlePhoneBlur}
              placeholder="+63 912 345 6789"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-blue focus:border-primary-blue text-gray-900"
            />
            {phoneError && (
              <span role="alert" className="text-red-600 text-sm mt-1 block">
                {phoneError}
              </span>
            )}
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* Email field (optional)                                               */}
          {/* ------------------------------------------------------------------ */}
          {/* ------------------------------------------------------------------ */}
          {/* Anonymity checkbox                                                   */}
          {/* ------------------------------------------------------------------ */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-start gap-3">
            <input
              id="report-anonymous"
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="w-4 h-4 mt-1 text-primary-blue rounded border-gray-300 focus:ring-primary-blue"
            />
            <label htmlFor="report-anonymous" className="text-sm text-gray-700 cursor-pointer">
              Submit this report anonymously
              <span className="block text-xs text-gray-500 mt-1">
                Your identity will not be shared with the public or responders
              </span>
            </label>
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* Privacy Consent — DPA compliance                                    */}
          {/* ------------------------------------------------------------------ */}
          <div className="space-y-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="privacyConsent"
                className="mt-1 w-4 h-4 text-primary-blue border-gray-300 rounded focus:ring-primary-blue"
                checked={privacyConsent}
                onChange={(e) => {
                  setPrivacyConsent(e.target.checked)
                  if (e.target.checked) setPrivacyConsentError(null)
                }}
              />
              <span className="text-sm text-gray-700">
                I have read and agree to the{' '}
                <a
                  href="/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-blue underline hover:text-blue-700"
                >
                  Privacy Policy
                </a>{' '}
                and consent to the collection and processing of my personal data.
              </span>
            </label>
            {privacyConsentError && (
              <span className="text-sm text-red-600" role="alert">
                {privacyConsentError}
              </span>
            )}
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* Submit                                                               */}
          {/* ------------------------------------------------------------------ */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setShowNonEmergency(true)}
              className="text-sm text-gray-500 underline hover:text-gray-700"
            >
              This isn&apos;t an emergency?
            </button>
            <button
              type="submit"
              className="w-full px-6 py-3 bg-primary-blue text-white font-semibold rounded-[24px] border-2 border-blue-600 shadow-lg hover:bg-blue-700 transition-colors"
            >
              Submit Report
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

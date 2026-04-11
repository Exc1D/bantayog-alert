import React, { useRef, useState } from 'react'
import { AlertCircle, WifiOff } from 'lucide-react'
import { Button } from '@/shared/components/Button'
import { ReportSuccess } from './ReportSuccess'
import { useReportQueue } from '../hooks/useReportQueue'
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportData {
  incidentType: IncidentType
  photo: File | null
  location: LocationValue
  description: string
  phone: string
  email?: string
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

const INCIDENT_TYPES: { value: IncidentType; label: string }[] = [
  { value: 'flood', label: 'Flood' },
  { value: 'earthquake', label: 'Earthquake' },
  { value: 'landslide', label: 'Landslide' },
  { value: 'fire', label: 'Fire' },
  { value: 'typhoon', label: 'Typhoon' },
  { value: 'medical_emergency', label: 'Medical Emergency' },
  { value: 'accident', label: 'Accident' },
  { value: 'infrastructure', label: 'Infrastructure Issue' },
  { value: 'crime', label: 'Crime' },
  { value: 'other', label: 'Other' },
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

// Basic email validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateEmail(value: string): string | null {
  if (!value.trim()) return null // Email is optional
  if (!EMAIL_REGEX.test(value.trim())) {
    return 'Please enter a valid email address'
  }
  return null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MAX_DESCRIPTION_CHARS = 500

export function ReportForm({
  userLocation,
  gpsError,
  onSubmit,
  onCreateAccount,
  onShare,
  onNavigate,
}: ReportFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { enqueueReport, isSyncing } = useReportQueue()
  const { isOnline } = useNetworkStatus()

  const [incidentType, setIncidentType] = useState<IncidentType>('other')
  const [photo, setPhoto] = useState<File | null>(null)
  const [municipality, setMunicipality] = useState('')
  const [barangay, setBarangay] = useState('')
  const [description, setDescription] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [injuriesConfirmed, setInjuriesConfirmed] = useState<boolean | undefined>(undefined)
  const [situationWorsening, setSituationWorsening] = useState<boolean | undefined>(undefined)
  const [submittedReportId, setSubmittedReportId] = useState<string | null>(null)

  const isGpsAvailable = Boolean(userLocation && !gpsError)
  const showManualDropdowns = Boolean(gpsError)

  function handlePhotoButtonClick() {
    fileInputRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setPhoto(file)
  }

  function handlePhoneBlur() {
    setPhoneError(validatePhone(phone))
  }

  function handleEmailBlur() {
    setEmailError(validateEmail(email))
  }

  function handleMunicipalityChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setMunicipality(e.target.value)
    setBarangay('') // reset barangay when municipality changes
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Re-validate phone before submission
    const error = validatePhone(phone)
    if (error) {
      setPhoneError(error)
      return
    }

    const location: LocationValue = isGpsAvailable
      ? { type: 'gps', latitude: userLocation!.latitude, longitude: userLocation!.longitude }
      : { type: 'manual', municipality, barangay }

    const reportData = {
      incidentType,
      photo,
      location,
      description,
      phone,
      email: email.trim() || undefined,
      injuriesConfirmed,
      situationWorsening,
    }

    // If offline, enqueue the report
    if (!isOnline) {
      enqueueReport(reportData)
      // Show queued success screen (different from immediate submission)
      const reportId = generateReportId(location)
      setSubmittedReportId(`${reportId}-queued`)
      return
    }

    // Generate Report ID and show success screen
    const reportId = generateReportId(location)
    setSubmittedReportId(reportId)

    onSubmit?.(reportData)
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
    ? `GPS: ${userLocation!.latitude.toFixed(4)}, ${userLocation!.longitude.toFixed(4)}`
    : null

  const availableBarangays = municipality ? (BARANGAYS[municipality] ?? []) : []

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
    <form onSubmit={handleSubmit} noValidate>
      {/* Offline indicator */}
      {!isOnline && (
        <div className="bg-orange-50 border-b border-orange-200 px-4 py-3 mb-4 flex items-center gap-2" data-testid="offline-banner">
          <WifiOff className="w-5 h-5 text-orange-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-orange-900">You're offline</p>
            <p className="text-xs text-orange-700">
              Your report will be queued and submitted automatically when you're back online.
            </p>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Photo field                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div>
        {/* Hidden file input associated with the visible label */}
        <label htmlFor="report-photo">Photo</label>
        <input
          id="report-photo"
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <button type="button" onClick={handlePhotoButtonClick}>
          Take Photo
        </button>
        {photo && <span>{photo.name}</span>}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Incident Type field                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <label htmlFor="report-incident-type">What's happening?</label>
        <select
          id="report-incident-type"
          value={incidentType}
          onChange={(e) => setIncidentType(e.target.value as IncidentType)}
          required
          aria-label="Select incident type"
        >
          {INCIDENT_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Location field                                                       */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <p>Location</p>

        {isGpsAvailable && (
          <div id="report-location" data-testid="location-display">
            {gpsLabel}
          </div>
        )}

        {showManualDropdowns && (
          <div id="report-location" data-testid="location-display">
            <label htmlFor="report-municipality">Select Municipality</label>
            <select
              id="report-municipality"
              value={municipality}
              onChange={handleMunicipalityChange}
              aria-label="Select Municipality"
            >
              <option value="">-- Select Municipality --</option>
              {MUNICIPALITIES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <label htmlFor="report-barangay">Select Barangay</label>
            <select
              id="report-barangay"
              value={barangay}
              onChange={(e) => setBarangay(e.target.value)}
              disabled={!municipality}
              aria-label="Select Barangay"
            >
              <option value="">-- Select Barangay --</option>
              {availableBarangays.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        )}

        {!isGpsAvailable && !showManualDropdowns && (
          <div id="report-location" data-testid="location-display">
            Detecting location…
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Description field                                                    */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <label htmlFor="report-description">Description</label>
        <textarea
          id="report-description"
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION_CHARS))}
          maxLength={MAX_DESCRIPTION_CHARS}
          rows={4}
        />
        <span>
          {description.length}/{MAX_DESCRIPTION_CHARS}
        </span>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Quick questions                                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700">Quick Questions (Optional)</p>

        {/* Anyone injured? */}
        <div className="flex flex-col gap-2">
          <span className="text-sm text-gray-600">Anyone injured?</span>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="injuries"
                checked={injuriesConfirmed === true}
                onChange={() => setInjuriesConfirmed(true)}
                className="w-4 h-4 text-primary-blue"
              />
              <span className="text-sm">Yes</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="injuries"
                checked={injuriesConfirmed === false}
                onChange={() => setInjuriesConfirmed(false)}
                className="w-4 h-4 text-primary-blue"
              />
              <span className="text-sm">No</span>
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
          <span className="text-sm text-gray-600">Is the situation getting worse?</span>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="worsening"
                checked={situationWorsening === true}
                onChange={() => setSituationWorsening(true)}
                className="w-4 h-4 text-primary-blue"
              />
              <span className="text-sm">Yes</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="worsening"
                checked={situationWorsening === false}
                onChange={() => setSituationWorsening(false)}
                className="w-4 h-4 text-primary-blue"
              />
              <span className="text-sm">No</span>
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
      <div>
        <label htmlFor="report-phone">Phone *</label>
        <input
          id="report-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onBlur={handlePhoneBlur}
          placeholder="+63 912 345 6789"
        />
        {phoneError && <span role="alert">{phoneError}</span>}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Email field (optional)                                               */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <label htmlFor="report-email">Email (Optional)</label>
        <input
          id="report-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={handleEmailBlur}
          placeholder="your@email.com"
        />
        {emailError && <span role="alert">{emailError}</span>}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Submit                                                               */}
      {/* ------------------------------------------------------------------ */}
      <Button variant="primary" type="submit">
        Submit Report
      </Button>
    </form>
  )
}

import React, { useRef, useState } from 'react'
import { Button } from '@/shared/components/Button'
import { ReportSuccess } from './ReportSuccess'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportData {
  photo: File | null
  location: LocationValue
  description: string
  phone: string
}

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
  if (!value.trim()) return null // phone is optional until submission
  if (!PH_PHONE_REGEX.test(value.trim())) {
    return 'Phone must be in format: +63 912 345 6789'
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

  const [photo, setPhoto] = useState<File | null>(null)
  const [municipality, setMunicipality] = useState('')
  const [barangay, setBarangay] = useState('')
  const [description, setDescription] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState<string | null>(null)
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

    // Generate Report ID and show success screen
    const reportId = generateReportId(location)
    setSubmittedReportId(reportId)

    onSubmit?.({ photo, location, description, phone })
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
    return (
      <ReportSuccess
        reportId={submittedReportId}
        municipality={getMunicipalityName()}
        onCreateAccount={onCreateAccount}
        onShare={handleShare}
        onNavigate={onNavigate}
      />
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
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
      {/* Phone field                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <label htmlFor="report-phone">Phone</label>
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
      {/* Submit                                                               */}
      {/* ------------------------------------------------------------------ */}
      <Button variant="primary" type="submit">
        Submit Report
      </Button>
    </form>
  )
}

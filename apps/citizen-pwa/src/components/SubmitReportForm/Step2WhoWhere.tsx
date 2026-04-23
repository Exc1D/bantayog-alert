import { useState, useEffect } from 'react'
import { MapPin, Navigation, ArrowLeft } from 'lucide-react'
import { Button } from '../ui/Button'
import { CAMARINES_NORTE_MUNICIPALITIES } from '@bantayog/shared-validators'
import { isQuotaExceededError, isSecurityError } from '../../utils/storage-errors'
import { useGpsLocation } from '../../hooks/useGpsLocation'
import { useMunicipalityBarangays } from '../../hooks/useMunicipalityBarangays'
import { MunicipalitySelector } from './MunicipalitySelector'
import { BarangaySelector } from './BarangaySelector'
import { ContactFields } from './ContactFields'

interface Step2WhoWhereProps {
  onNext: (data: {
    location: { lat: number; lng: number }
    reporterName: string
    reporterMsisdn: string
    patientCount: number
    locationMethod: 'gps' | 'manual'
    municipalityId?: string
    municipalityLabel?: string
    barangayId?: string
    nearestLandmark?: string
  }) => void
  onBack: () => void
  isSubmitting?: boolean
}

export function Step2WhoWhere({ onNext, onBack, isSubmitting = false }: Step2WhoWhereProps) {
  const {
    location,
    locationMethod,
    isLoading: gpsLoading,
    locationError,
    attemptGps,
    resetGps,
    setLocationMethod,
  } = useGpsLocation(true)

  const {
    selectedMunicipalityId,
    selectedBarangayId,
    handleSelectMunicipality,
    setSelectedBarangayId,
  } = useMunicipalityBarangays()

  const [nearestLandmark, setNearestLandmark] = useState<string>('')
  const [reporterName, setReporterName] = useState('')
  const [reporterMsisdn, setReporterMsisdn] = useState('')
  const [anyoneHurt, setAnyoneHurt] = useState(false)
  const [patientCount, setPatientCount] = useState(0)
  const [nameError, setNameError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [hasMemory, setHasMemory] = useState(false)

  useEffect(() => {
    try {
      const savedName = localStorage.getItem('bantayog.reporter.name')
      // Phone is session-only to limit long-lived PII exposure
      const savedMsisdn = sessionStorage.getItem('bantayog.reporter.msisdn')
      if (savedName || savedMsisdn) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (savedName) setReporterName(savedName)
        if (savedMsisdn) setReporterMsisdn(savedMsisdn)
        setHasMemory(true)
      }
    } catch (err: unknown) {
      if (isQuotaExceededError(err)) {
        console.warn('[Step2WhoWhere] Storage quota exceeded, skipping pre-fill')
      } else if (!isSecurityError(err)) {
        console.warn('[Step2WhoWhere] Unexpected storage read error, skipping pre-fill', err)
      }
      // SecurityError (private mode) is intentionally silent
    }
  }, [])

  const handleNext = () => {
    setNameError(null)
    setPhoneError(null)

    if (locationMethod === 'manual' && !selectedMunicipalityId) {
      // Note: locationError is managed by useGpsLocation hook
      return
    }
    if (!reporterName.trim()) {
      setNameError('Please enter your name.')
      return
    }
    if (!reporterMsisdn.trim()) {
      setPhoneError('Please enter your phone number.')
      return
    }

    let finalLocation = location
    let municipalityLabel: string | undefined
    if (locationMethod === 'manual' && selectedMunicipalityId) {
      const muni = CAMARINES_NORTE_MUNICIPALITIES.find((m) => m.id === selectedMunicipalityId)
      municipalityLabel = muni?.label
      if (muni?.centroid) {
        finalLocation = { lat: muni.centroid.lat, lng: muni.centroid.lng }
      } else {
        finalLocation ??= { lat: 0, lng: 0 }
      }
    }

    try {
      localStorage.setItem('bantayog.reporter.name', reporterName)
      // Phone is session-only to limit long-lived PII exposure
      sessionStorage.setItem('bantayog.reporter.msisdn', reporterMsisdn)
    } catch (err: unknown) {
      if (isQuotaExceededError(err)) {
        console.warn('[Step2WhoWhere] Storage quota exceeded, skipping persist')
      } else if (!isSecurityError(err)) {
        console.warn('[Step2WhoWhere] Unexpected storage write error, skipping persist', err)
      }
      // SecurityError (private mode) is intentionally silent
    }

    onNext({
      location: finalLocation ?? { lat: 0, lng: 0 },
      reporterName,
      reporterMsisdn,
      patientCount: anyoneHurt ? patientCount : 0,
      locationMethod: locationMethod ?? 'manual',
      ...(locationMethod === 'manual' && selectedMunicipalityId
        ? {
            municipalityId: selectedMunicipalityId,
            ...(municipalityLabel ? { municipalityLabel } : {}),
            ...(selectedBarangayId ? { barangayId: selectedBarangayId } : {}),
            ...(nearestLandmark ? { nearestLandmark } : {}),
          }
        : {}),
    })
  }

  const canProceed =
    (locationMethod === 'gps' && !!location) ||
    (locationMethod === 'manual' && !!selectedMunicipalityId) ||
    false

  return (
    <div className="page-container">
      <div className="page-header">
        <button type="button" onClick={onBack} aria-label="Go back" className="back-btn">
          <ArrowLeft size={16} />
        </button>
        <span className="step-indicator">2 of 3</span>
      </div>

      <div className="progress-dots">
        <div className="progress-dot progress-dot--active" />
        <div className="progress-dot progress-dot--active" />
        <div className="progress-dot progress-dot--inactive" />
      </div>

      <h2 className="step-title">Where and who?</h2>
      <p className="step-subtitle">All fields below are required</p>

      {locationMethod === null && !gpsLoading ? (
        <div className="location-picker-start">
          <p className="location-picker-prompt">How would you like to provide your location?</p>
          <button
            type="button"
            className="location-picker-btn"
            onClick={() => {
              void attemptGps()
            }}
          >
            <Navigation size={18} />
            <span>Use current location (GPS)</span>
          </button>
          <button
            type="button"
            className="location-picker-btn"
            onClick={() => {
              setLocationMethod('manual')
            }}
          >
            <MapPin size={18} />
            <span>Choose municipality manually</span>
          </button>
        </div>
      ) : null}

      {gpsLoading ? (
        <div className="location-loading">
          <div className="location-loading-spinner" />
          <p className="location-loading-text">Getting your location...</p>
        </div>
      ) : null}

      {locationMethod === 'gps' && location ? (
        <div className="field-group">
          <p className="field-label">Location</p>
          <button
            type="button"
            className="location-btn"
            onClick={() => {
              resetGps()
            }}
          >
            <div className="location-icon">
              <Navigation size={14} />
            </div>
            <div className="location-info">
              <div className="location-primary">
                {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
              </div>
              <div className="location-secondary">GPS · accuracy varies</div>
            </div>
            <span className="location-change">Change</span>
          </button>
          {locationError && <p className="field-error">{locationError}</p>}
          <div className="map-preview">
            <div className="map-marker" />
          </div>
        </div>
      ) : null}

      {locationMethod === 'manual' ? (
        <MunicipalitySelector
          value={selectedMunicipalityId}
          onChange={handleSelectMunicipality}
          error={locationError}
        />
      ) : null}

      {locationMethod === 'manual' && (
        <BarangaySelector
          municipalityId={selectedMunicipalityId}
          value={selectedBarangayId ?? ''}
          onChange={setSelectedBarangayId}
        />
      )}

      {locationMethod === 'manual' && selectedMunicipalityId ? (
        <div className="field-group">
          <p className="field-label">
            Nearest landmark
            <span className="field-label-optional"> — optional</span>
          </p>
          <input
            type="text"
            value={nearestLandmark}
            onChange={(e) => {
              setNearestLandmark(e.target.value)
            }}
            placeholder="e.g. Near the town plaza, across from Mang Juan Store"
            className="text-input"
            maxLength={200}
          />
        </div>
      ) : null}

      {locationMethod !== null ? (
        <>
          <ContactFields
            reporterName={reporterName}
            onReporterNameChange={setReporterName}
            nameError={nameError}
            onNameErrorClear={() => {
              setNameError(null)
            }}
            reporterMsisdn={reporterMsisdn}
            onReporterMsisdnChange={setReporterMsisdn}
            phoneError={phoneError}
            onPhoneErrorClear={() => {
              setPhoneError(null)
            }}
            anyoneHurt={anyoneHurt}
            onAnyoneHurtChange={setAnyoneHurt}
            patientCount={patientCount}
            onPatientCountChange={setPatientCount}
            hasMemory={hasMemory}
          />

          <Button
            variant="primary"
            fullWidth
            onClick={handleNext}
            disabled={!canProceed || isSubmitting}
            style={{ marginTop: '1.5rem' }}
          >
            {isSubmitting ? 'Please wait...' : 'Continue'}
          </Button>
        </>
      ) : null}
    </div>
  )
}

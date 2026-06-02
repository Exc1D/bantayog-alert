import { useState, useEffect } from 'react'
import { MapPin, Navigation, ArrowLeft } from 'lucide-react'
import { Button } from '../ui/Button'
import { CAMARINES_NORTE_MUNICIPALITIES } from '@bantayog/shared-validators'
import { isQuotaExceededError, isSecurityError } from '../../utils/storage-errors'
import { useGpsLocation } from '../../hooks/useGpsLocation'
import { useMunicipalityBarangays } from '../../hooks/useMunicipalityBarangays'
import { getAutoLocationEnabled } from '../../lib/userSettings'
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
  initialValues?: {
    location?: { lat: number; lng: number }
    reporterName?: string
    reporterMsisdn?: string
    patientCount?: number
    locationMethod?: 'gps' | 'manual'
    municipalityId?: string
    barangayId?: string
    nearestLandmark?: string
  }
}

export function Step2WhoWhere({
  onNext,
  onBack,
  isSubmitting = false,
  initialValues,
}: Step2WhoWhereProps) {
  const {
    location,
    locationMethod,
    isLoading: gpsLoading,
    locationError,
    attemptGps,
    resetGps,
    setLocationMethod,
  } = useGpsLocation(getAutoLocationEnabled())

  const {
    selectedMunicipalityId,
    selectedBarangayId,
    handleSelectMunicipality,
    handleSelectBarangay,
  } = useMunicipalityBarangays()

  const [nearestLandmark, setNearestLandmark] = useState<string>('')
  const [reporterName, setReporterName] = useState('')
  const [reporterMsisdn, setReporterMsisdn] = useState('')
  const [anyoneHurt, setAnyoneHurt] = useState(false)
  const [patientCount, setPatientCount] = useState(0)
  const [nameError, setNameError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [hasMemory, setHasMemory] = useState(false)
  const [municipalityError, setMunicipalityError] = useState<string | null>(null)

  // Hydrate from snapshot when resuming or navigating back to Step 2.
  useEffect(() => {
    if (!initialValues) return

    if (initialValues.locationMethod) setLocationMethod(initialValues.locationMethod)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialValues.reporterName) setReporterName(initialValues.reporterName)

    if (initialValues.reporterMsisdn) setReporterMsisdn(initialValues.reporterMsisdn)
    if (initialValues.patientCount) {
      setPatientCount(initialValues.patientCount)

      setAnyoneHurt(initialValues.patientCount > 0)
    }

    if (initialValues.nearestLandmark) setNearestLandmark(initialValues.nearestLandmark)
    // Municipality / barangay are handled via useMunicipalityBarangays; those
    // hooks don't expose setters, so we rely on localStorage/sessionStorage
    // pre-fill below for reporter fields, and the user re-selects location.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    try {
      const savedName = sessionStorage.getItem('bantayog.reporter.name')
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
    }
  }, [])

  const handleNext = () => {
    setNameError(null)
    setPhoneError(null)
    setMunicipalityError(null)

    if (locationMethod === 'manual' && !selectedMunicipalityId) {
      setMunicipalityError('Please select a municipality.')
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
      sessionStorage.setItem('bantayog.reporter.name', reporterName)
      sessionStorage.setItem('bantayog.reporter.msisdn', reporterMsisdn)
    } catch (err: unknown) {
      if (isQuotaExceededError(err)) {
        console.warn('[Step2WhoWhere] Storage quota exceeded, skipping persist')
      } else if (!isSecurityError(err)) {
        console.warn('[Step2WhoWhere] Unexpected storage write error, skipping persist', err)
      }
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
    <div className="min-h-[100dvh] bg-surface-100 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-nav bg-surface-100/90 border-b border-surface-200 px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="w-11 h-11 flex items-center justify-center rounded-full active:bg-surface-200 transition-colors"
        >
          <ArrowLeft size={24} className="text-surface-700" />
        </button>
        <h1 className="text-lg font-semibold text-surface-900 flex-1">Location &amp; Contact</h1>
        <span className="text-sm font-medium text-surface-400">Step 2 of 3</span>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 px-5 pt-4 pb-2">
        {[1, 2, 3].map((n) => {
          const isCompleted = 2 > n
          const isCurrent = 2 === n
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-4 space-y-6">
        {/* Location */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-surface-700 block">Location</p>

          {locationMethod === null && !gpsLoading ? (
            <div className="space-y-2">
              <button
                type="button"
                className="w-full flex items-center gap-3 px-4 py-3.5 bg-white border border-surface-200 rounded-xl cursor-pointer text-sm font-semibold text-surface-900 active:bg-surface-50 transition-colors text-left"
                onClick={() => {
                  void attemptGps()
                }}
              >
                <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center">
                  <Navigation size={16} className="text-brand-500" />
                </div>
                Use current location (GPS)
              </button>
              <button
                type="button"
                className="w-full flex items-center gap-3 px-4 py-3.5 bg-white border border-surface-200 rounded-xl cursor-pointer text-sm font-semibold text-surface-900 active:bg-surface-50 transition-colors text-left"
                onClick={() => {
                  setLocationMethod('manual')
                }}
              >
                <div className="w-8 h-8 rounded-full bg-surface-100 flex items-center justify-center">
                  <MapPin size={16} className="text-surface-600" />
                </div>
                Pick my municipality manually
              </button>
            </div>
          ) : null}

          {gpsLoading ? (
            <div className="flex flex-col items-center gap-3 py-8 bg-white rounded-xl border border-surface-200">
              <div className="w-6 h-6 border-2 border-surface-200 border-t-brand-500 rounded-full animate-spin" />
              <p className="text-sm text-surface-600">Getting your location...</p>
            </div>
          ) : null}

          {locationMethod === 'gps' && !gpsLoading && !location ? (
            <div className="space-y-2">
              {locationError && <p className="text-xs text-danger-500">{locationError}</p>}
              <button
                type="button"
                className="w-full flex items-center gap-3 px-4 py-3.5 bg-white border border-surface-200 rounded-xl cursor-pointer text-sm font-semibold text-surface-900 active:bg-surface-50 transition-colors text-left"
                onClick={() => {
                  resetGps()
                  setLocationMethod('manual')
                }}
              >
                <div className="w-8 h-8 rounded-full bg-surface-100 flex items-center justify-center">
                  <MapPin size={16} className="text-surface-600" />
                </div>
                Switch to manual location
              </button>
            </div>
          ) : null}

          {locationMethod === 'gps' && location ? (
            <div className="bg-white rounded-xl border border-surface-200 p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center">
                  <Navigation size={16} className="text-brand-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-surface-900">
                    {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                  </p>
                  <p className="text-xs text-surface-400">GPS · accuracy varies</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    resetGps()
                  }}
                  className="min-h-11 px-2 text-xs font-semibold text-brand-500 bg-transparent border-none cursor-pointer"
                >
                  Change
                </button>
              </div>
              {locationError && <p className="text-xs text-danger-500">{locationError}</p>}
              <div className="bg-surface-100 rounded-lg h-14 relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-warning-500 border-2 border-white rounded-full" />
              </div>
            </div>
          ) : null}

          {locationMethod === 'manual' ? (
            <div className="space-y-3">
              <MunicipalitySelector
                value={selectedMunicipalityId}
                onChange={(muniId) => {
                  setMunicipalityError(null)
                  handleSelectMunicipality(muniId)
                }}
                error={municipalityError}
              />
              <BarangaySelector
                municipalityId={selectedMunicipalityId}
                value={selectedBarangayId ?? ''}
                onChange={handleSelectBarangay}
              />
            </div>
          ) : null}

          {locationMethod === 'manual' && selectedMunicipalityId ? (
            <div>
              <label
                htmlFor="report-landmark"
                className="text-sm font-semibold text-surface-700 block mb-2"
              >
                Nearest landmark
                <span className="font-normal text-surface-400 ml-1">(optional)</span>
              </label>
              <input
                id="report-landmark"
                name="landmark"
                type="text"
                value={nearestLandmark}
                onChange={(e) => {
                  setNearestLandmark(e.target.value)
                }}
                placeholder="e.g. Near the town plaza, across from Mang Juan Store"
                className="w-full min-h-[56px] rounded-xl border-2 border-surface-200 bg-white px-4 text-base text-surface-900 placeholder:text-surface-300 focus:border-brand-500 focus:outline-none transition-colors"
                maxLength={200}
              />
            </div>
          ) : null}
        </div>

        {/* Contact + Is anyone hurt */}
        {locationMethod !== null && (
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
        )}
      </div>

      {/* Bottom action — always rendered so users always see what to do next.
          Before a location method is picked, show a polite hint instead of
          hiding the entire region (which previously felt like silent failure). */}
      <div className="sticky bottom-0 z-float bg-surface-100/90 border-t border-surface-200 px-5 py-4">
        {locationMethod === null ? (
          <p role="status" className="text-center text-sm font-medium text-surface-700">
            Pick a location method above (GPS or Manual) to continue.
          </p>
        ) : (
          <Button
            variant="primary"
            fullWidth
            onClick={handleNext}
            disabled={!canProceed || isSubmitting}
          >
            {isSubmitting ? 'Please wait...' : 'Review Report'}
          </Button>
        )}
      </div>
    </div>
  )
}

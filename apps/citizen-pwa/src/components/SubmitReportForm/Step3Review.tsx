import { useState } from 'react'
import {
  ArrowLeft,
  Heart,
  Droplets,
  Flame,
  Wind,
  Mountain,
  Waves,
  AlertTriangle,
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
  { value: 'flood', label: 'Flood', Icon: Droplets },
  { value: 'fire', label: 'Fire', Icon: Flame },
  { value: 'earthquake', label: 'Earthquake', Icon: AlertTriangle },
  { value: 'typhoon', label: 'Typhoon', Icon: Wind },
  { value: 'landslide', label: 'Landslide', Icon: Mountain },
  { value: 'storm_surge', label: 'Storm Surge', Icon: Waves },
] as const

export function Step3Review({
  onBack,
  onSubmit,
  reportData,
  isSubmitting = false,
}: Step3ReviewProps) {
  const [consent, setConsent] = useState(false)

  const incident = INCIDENT_TYPES.find((t) => t.value === reportData.reportType)
  const Icon = incident?.Icon ?? Zap

  return (
    <div className="page-container">
      <div className="page-header">
        <button type="button" onClick={onBack} aria-label="Go back" className="back-btn">
          <ArrowLeft size={16} />
        </button>
        <span className="step-indicator">3 of 3</span>
      </div>

      <div className="progress-dots">
        <div className="progress-dot progress-dot--active" />
        <div className="progress-dot progress-dot--active" />
        <div className="progress-dot progress-dot--active" />
      </div>

      <div className="consent-banner">
        <div className="consent-ornament" />
        <div className="consent-row">
          <div className="consent-heart">
            <Heart size={16} />
          </div>
          <p className="consent-text">
            <strong>We heard you. We are here.</strong> We&apos;ll let you know when help is on the
            way. Please keep your line open.
          </p>
        </div>
      </div>

      <h2 className="step-title">Review your report</h2>

      <div className="review-card">
        <p className="review-label">Incident</p>
        <div className="review-value">
          <Icon
            size={14}
            style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}
          />
          {incident?.label ?? reportData.reportType}
        </div>
        <div className="review-subvalue">
          {reportData.patientCount} {reportData.patientCount === 1 ? 'patient' : 'patients'}
        </div>
      </div>

      <div className="review-card">
        <p className="review-label">Contact</p>
        <div className="review-value">{reportData.reporterName}</div>
        <div className="review-subvalue">{reportData.reporterMsisdn}</div>
      </div>

      <div className="review-card">
        <p className="review-label">Location</p>
        {reportData.locationMethod === 'manual' && reportData.municipalityLabel ? (
          <>
            <div className="review-value">
              {reportData.municipalityLabel}
              {reportData.barangayId ? `, ${reportData.barangayId}` : ''}
            </div>
            {reportData.nearestLandmark ? (
              <div className="review-subvalue">{reportData.nearestLandmark}</div>
            ) : null}
            <div className="review-subvalue">Manual location</div>
          </>
        ) : (
          <>
            <div className="review-value">
              {reportData.location.lat.toFixed(5)}, {reportData.location.lng.toFixed(5)}
            </div>
            <div className="review-subvalue">GPS coordinates</div>
          </>
        )}
      </div>

      <label className="consent-checkbox-label">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => {
            setConsent(e.target.checked)
          }}
          className="consent-checkbox"
        />
        <span className="consent-text-small">
          I confirm this report is true. You may contact me. <u>Privacy notice ›</u>
        </span>
      </label>

      <Button variant="primary" fullWidth onClick={onSubmit} disabled={!consent || isSubmitting}>
        {isSubmitting ? 'Submitting...' : 'Submit report'}
      </Button>
    </div>
  )
}

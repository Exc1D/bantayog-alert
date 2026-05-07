import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { reportDocSchema } from '@bantayog/shared-validators'
import { useSubmitResponderWitnessedReport } from '../hooks/useSubmitResponderWitnessedReport'
import styles from './DispatchDetailPage.module.css'

const REPORT_TYPES = reportDocSchema.shape.reportType.options

type GpsState =
  | { status: 'pending' }
  | { status: 'captured'; coords: GeolocationCoordinates }
  | { status: 'error'; message: string }

export function ResponderWitnessReportPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { submit, loading, error } = useSubmitResponderWitnessedReport(id ?? '')

  const [reportType, setReportType] = useState('')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [gps, setGps] = useState<GpsState>({ status: 'pending' })
  const fileInputRef = useRef<HTMLInputElement>(null)

  function requestGps() {
    setGps({ status: 'pending' })
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ status: 'captured', coords: pos.coords })
      },
      (err) => {
        setGps({ status: 'error', message: err.message })
      },
    )
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    requestGps()
  }, [])

  const gpsReady = gps.status === 'captured'
  const canSubmit = gpsReady && !!reportType && !!description.trim() && !!severity

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const normalizedDescription = description.trim()
    if (!reportType || !normalizedDescription || !severity) {
      setValidationError('Report type, description, and severity are required.')
      return
    }
    if (!gpsReady) {
      setValidationError('GPS location is required.')
      return
    }
    setValidationError(null)
    try {
      await submit({
        reportType,
        description: normalizedDescription,
        severity,
      })
      void navigate(`/dispatches/${id ?? ''}`)
    } catch (err: unknown) {
      console.error('[ResponderWitnessReportPage] submit failed:', err)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <button
          className={styles.backBtn}
          onClick={() => void navigate(`/dispatches/${id ?? ''}`)}
          aria-label="Back"
        >
          ←
        </button>
        <h1 className={styles.pageTitle}>File Witness Report</h1>
      </div>

      <div className={styles.body}>
        {/* GPS status */}
        <div aria-live="polite" aria-atomic="true">
          {gps.status === 'captured' && (
            <p className={styles.gpsSuccess ?? ''}>Location captured</p>
          )}
          {gps.status === 'error' && (
            <div>
              <p className={styles.errorMsg}>Location unavailable: {gps.message}</p>
              <button type="button" onClick={requestGps} className={styles.toggleBtn}>
                Retry
              </button>
            </div>
          )}
          {gps.status === 'pending' && (
            <p className={styles.gpsSuccess ?? ''}>Acquiring GPS location…</p>
          )}
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className={styles.statusSection}>
          <div>
            <label htmlFor="reportType" className={styles.statusTitle}>
              Report type
            </label>
            <select
              id="reportType"
              value={reportType}
              onChange={(e) => {
                setReportType(e.target.value)
              }}
              required
              className={styles.select}
            >
              <option value="">Select…</option>
              {REPORT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="description" className={styles.statusTitle}>
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
              }}
              placeholder="Describe what you witnessed"
              rows={4}
              required
              className={styles.textarea}
            />
          </div>
          <fieldset className={styles.statusSection} style={{ border: 'none', padding: 0 }}>
            <legend className={styles.statusTitle}>Severity</legend>
            <div className={styles.quickToggles}>
              {(['low', 'medium', 'high'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSeverity(s)
                  }}
                  className={[styles.toggleBtn, severity === s ? styles.togglePrimary : '']
                    .filter(Boolean)
                    .join(' ')}
                >
                  {s}
                </button>
              ))}
            </div>
          </fieldset>
          <div>
            <button
              type="button"
              className={styles.toggleBtn}
              onClick={() => {
                fileInputRef.current?.click()
              }}
            >
              Add photo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null
                setPhotoFile(file)
              }}
              aria-label="Photo attachment"
            />
            {photoFile !== null && <span className={styles.statusTitle}>{photoFile.name}</span>}
          </div>
          {validationError !== null && (
            <p role="alert" className={styles.errorMsg}>
              {validationError}
            </p>
          )}
          {error !== undefined && <p className={styles.errorMsg}>{error.message}</p>}
          <div className={styles.quickToggles}>
            <button
              type="submit"
              disabled={!canSubmit || loading}
              className={[styles.toggleBtn, styles.togglePrimary].filter(Boolean).join(' ')}
            >
              {loading ? 'Submitting…' : 'Submit report'}
            </button>
            <button
              type="button"
              onClick={() => void navigate(`/dispatches/${id ?? ''}`)}
              disabled={loading}
              className={styles.toggleBtn}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { reportDocSchema } from '@bantayog/shared-validators'
import { useSubmitResponderWitnessedReport } from '../hooks/useSubmitResponderWitnessedReport'
import styles from './DispatchDetailPage.module.css'

const REPORT_TYPES = reportDocSchema.shape.reportType.options

export function ResponderWitnessReportPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { submit, loading, error } = useSubmitResponderWitnessedReport(id ?? '')

  const [reportType, setReportType] = useState('')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const normalizedDescription = description.trim()
    if (!reportType || !normalizedDescription || !severity) {
      setValidationError('Report type, description, and severity are required.')
      return
    }
    setValidationError(null)
    try {
      await submit({
        reportType,
        description: normalizedDescription,
        severity,
        ...(photoUrl.trim() ? { photoUrl: photoUrl.trim() } : {}),
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
            <label htmlFor="photoUrl" className={styles.statusTitle}>
              Photo URL (optional)
            </label>
            <input
              id="photoUrl"
              type="url"
              value={photoUrl}
              onChange={(e) => {
                setPhotoUrl(e.target.value)
              }}
              placeholder="https://..."
              className={styles.select}
            />
          </div>
          {validationError && (
            <p role="alert" className={styles.errorMsg}>
              {validationError}
            </p>
          )}
          {error && <p className={styles.errorMsg}>{error.message}</p>}
          <div className={styles.quickToggles}>
            <button
              type="submit"
              disabled={loading}
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

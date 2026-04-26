import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSubmitResponderWitnessedReport } from '../hooks/useSubmitResponderWitnessedReport'

const REPORT_TYPES = [
  'flood',
  'fire',
  'earthquake',
  'typhoon',
  'landslide',
  'storm_surge',
  'medical',
  'accident',
  'structural',
  'security',
  'other',
] as const

export function ResponderWitnessReportPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { submit, loading, error } = useSubmitResponderWitnessedReport(id ?? '')

  const [reportType, setReportType] = useState('')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!reportType || !description.trim() || !severity) return
    try {
      await submit({
        reportType,
        description: description.trim(),
        severity,
        ...(photoUrl.trim() ? { photoUrl: photoUrl.trim() } : {}),
      })
      void navigate(`/dispatches/${id ?? ''}`)
    } catch {
      // error surfaced by hook
    }
  }

  return (
    <main>
      <h1>File Witness Report</h1>
      <form onSubmit={(e) => void handleSubmit(e)}>
        <div>
          <label htmlFor="reportType">Report type</label>
          <select
            id="reportType"
            value={reportType}
            onChange={(e) => {
              setReportType(e.target.value)
            }}
            required
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
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value)
            }}
            placeholder="Describe what you witnessed"
            rows={4}
            required
          />
        </div>
        <fieldset>
          <legend>Severity</legend>
          {(['low', 'medium', 'high'] as const).map((s) => (
            <label key={s}>
              <input
                type="radio"
                name="severity"
                value={s}
                checked={severity === s}
                onChange={() => {
                  setSeverity(s)
                }}
                required
              />
              {s}
            </label>
          ))}
        </fieldset>
        <div>
          <label htmlFor="photoUrl">Photo URL (optional)</label>
          <input
            id="photoUrl"
            type="url"
            value={photoUrl}
            onChange={(e) => {
              setPhotoUrl(e.target.value)
            }}
            placeholder="https://..."
          />
        </div>
        {error && <p style={{ color: 'red' }}>{error.message}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Submitting…' : 'Submit report'}
        </button>
        <button
          type="button"
          onClick={() => {
            void navigate(`/dispatches/${id ?? ''}`)
          }}
          disabled={loading}
        >
          Cancel
        </button>
      </form>
    </main>
  )
}

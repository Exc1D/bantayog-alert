import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TriangleAlert } from 'lucide-react'
import { callables } from '../services/callables'

// ── Constants ─────────────────────────────────────────────────────────────────

const HAZARD_TYPES = [
  { value: 'typhoon', label: 'Typhoon' },
  { value: 'flood', label: 'Flood' },
  { value: 'landslide', label: 'Landslide' },
  { value: 'earthquake', label: 'Earthquake' },
  { value: 'fire', label: 'Fire' },
  { value: 'storm_surge', label: 'Storm Surge' },
  { value: 'other', label: 'Other' },
] as const

const MUNICIPALITIES = [
  'camarines_norte',
  'daet',
  'labo',
  'sta_elena',
  'capalonga',
  'vinzons',
  'jose_panganiban',
  'mercedes',
  'paracale',
  'san_lorenzo_ruiz',
  'san_vicente',
  'talisay',
  'basud',
] as const

// ── Styles ────────────────────────────────────────────────────────────────────

const PAGE: React.CSSProperties = {
  padding: '24px',
  maxWidth: '720px',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '24px',
}

const CARD: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '20px 24px',
}

const LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: '#374151',
  marginBottom: '6px',
}

const INPUT: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  fontSize: '14px',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const BTN_PRIMARY: React.CSSProperties = {
  padding: '10px 20px',
  background: '#a73400',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
}

const SECTION_LABEL: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#6b7280',
  margin: '0 0 8px',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ProvinceEmergencyPage() {
  const navigate = useNavigate()

  const [hazardType, setHazardType] = useState('')
  const [selectedMunicipalities, setSelectedMunicipalities] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ alertId: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Global keyboard shortcut: A navigates to this page
  // (handled by ShellKeyboardShortcuts component at shell level)

  function toggleMunicipality(id: string) {
    setSelectedMunicipalities((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    )
  }

  const canDeclare =
    hazardType.length > 0 &&
    selectedMunicipalities.length > 0 &&
    message.trim().length >= 20 &&
    !submitting

  async function handleDeclare() {
    if (!canDeclare) return
    setSubmitting(true)
    setError(null)
    try {
      const data = await callables.declareEmergency({
        hazardType,
        affectedMunicipalityIds: selectedMunicipalities,
        message: message.trim(),
      })
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Declaration failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success view ─────────────────────────────────────────────────────────────

  if (result !== null) {
    return (
      <main style={PAGE}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#1d1d1f', margin: 0 }}>
          Emergency Declaration
        </h1>
        <div
          style={{
            background: '#dcfce7',
            border: '1px solid #86efac',
            borderRadius: '8px',
            padding: '16px 20px',
            color: '#166534',
          }}
        >
          <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '15px' }}>
            Emergency declared successfully
          </p>
          <p style={{ margin: 0, fontSize: '13px' }}>
            Alert ID: <code style={{ fontFamily: 'monospace' }}>{result.alertId}</code>
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void navigate('/province/dashboard')
          }}
          style={{ ...BTN_PRIMARY, background: '#001e40', alignSelf: 'flex-start' }}
        >
          Back to Dashboard
        </button>
      </main>
    )
  }

  // ── Declaration form ─────────────────────────────────────────────────────────

  return (
    <main style={PAGE}>
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#1d1d1f', margin: '0 0 4px' }}>
          Emergency Declaration
        </h1>
        <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
          Declare a provincial emergency alert. This will notify all affected municipalities and
          trigger the NDRRMC escalation workflow.
        </p>
      </div>

      <div
        style={{
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: '8px',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          color: '#b91c1c',
          fontSize: '13px',
        }}
      >
        <TriangleAlert size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          Emergency declarations trigger province-wide notifications and are permanently logged. Use
          only for genuine emergencies.
        </span>
      </div>

      <div style={CARD}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Hazard type */}
          <div>
            <label htmlFor="hazard-type" style={LABEL}>
              Hazard Type
            </label>
            <select
              id="hazard-type"
              value={hazardType}
              onChange={(e) => {
                setHazardType(e.target.value)
              }}
              style={{ ...INPUT, minHeight: '40px' }}
            >
              <option value="">Select hazard type…</option>
              {HAZARD_TYPES.map((h) => (
                <option key={h.value} value={h.value}>
                  {h.label}
                </option>
              ))}
            </select>
          </div>

          {/* Affected municipalities */}
          <div>
            <p style={SECTION_LABEL}>Affected Municipalities</p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '8px',
              }}
            >
              {MUNICIPALITIES.map((id) => {
                const checked = selectedMunicipalities.includes(id)
                return (
                  <label
                    key={id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '13px',
                      color: '#374151',
                      cursor: 'pointer',
                      padding: '6px 8px',
                      borderRadius: '4px',
                      background: checked ? '#fee2e2' : 'transparent',
                      border: checked ? '1px solid #fca5a5' : '1px solid transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        toggleMunicipality(id)
                      }}
                    />
                    {id.replace(/_/g, ' ')}
                  </label>
                )
              })}
            </div>
            {selectedMunicipalities.length === 0 && (
              <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#9ca3af' }}>
                Select at least one municipality
              </p>
            )}
          </div>

          {/* Message */}
          <div>
            <label htmlFor="emergency-message" style={LABEL}>
              Emergency Message (minimum 20 characters)
            </label>
            <textarea
              id="emergency-message"
              value={message}
              onChange={(e) => {
                setMessage(e.target.value)
              }}
              rows={5}
              style={{ ...INPUT, resize: 'vertical' }}
              placeholder="Describe the emergency situation, immediate actions required, and instructions for affected municipalities."
            />
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#9ca3af' }}>
              {String(message.trim().length)} / 20 characters minimum
            </p>
          </div>

          {error !== null && (
            <p role="alert" style={{ margin: 0, fontSize: '13px', color: '#b91c1c' }}>
              {error}
            </p>
          )}

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              type="button"
              disabled={!canDeclare}
              onClick={() => {
                void handleDeclare()
              }}
              style={{
                ...BTN_PRIMARY,
                opacity: canDeclare ? 1 : 0.5,
                cursor: canDeclare ? 'pointer' : 'not-allowed',
              }}
            >
              {submitting ? 'Declaring…' : 'Declare Emergency'}
            </button>
            <button
              type="button"
              onClick={() => {
                void navigate('/province/dashboard')
              }}
              style={{
                padding: '10px 18px',
                background: '#fff',
                color: '#6b7280',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}

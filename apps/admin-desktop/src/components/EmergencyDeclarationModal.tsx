import { useState, useRef } from 'react'
import { CAMARINES_NORTE_MUNICIPALITIES } from '@bantayog/shared-validators'
import { callables } from '../services/callables'

interface EmergencyDeclarationModalProps {
  open: boolean
  onClose: () => void
}

type Step = 1 | 2

const OVERLAY_STYLE: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
}

const MODAL_STYLE: React.CSSProperties = {
  background: '#fff',
  borderRadius: '8px',
  padding: '24px',
  width: '480px',
  maxWidth: '90vw',
  maxHeight: '85vh',
  overflowY: 'auto',
  boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
}

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #d0d0d0',
  borderRadius: '4px',
  fontSize: '14px',
  boxSizing: 'border-box',
}

const LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  marginBottom: '4px',
  color: '#333',
}

const ERROR_STYLE: React.CSSProperties = {
  color: '#dc2626',
  fontSize: '13px',
  marginTop: '12px',
  padding: '8px 10px',
  background: '#fef2f2',
  borderRadius: '4px',
  border: '1px solid #fca5a5',
}

const SUCCESS_STYLE: React.CSSProperties = {
  color: '#065f46',
  fontSize: '13px',
  marginTop: '12px',
  padding: '8px 10px',
  background: '#d1fae5',
  borderRadius: '4px',
  border: '1px solid #6ee7b7',
}

const IMPACT_NOTE_STYLE: React.CSSProperties = {
  fontSize: '12px',
  color: '#92400e',
  background: '#fffbeb',
  border: '1px solid #fcd34d',
  borderRadius: '4px',
  padding: '8px 10px',
  marginTop: '12px',
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={LABEL_STYLE}>{label}</label>
      {children}
    </div>
  )
}

export function EmergencyDeclarationModal({ open, onClose }: EmergencyDeclarationModalProps) {
  const [step, setStep] = useState<Step>(1)
  const [hazardType, setHazardType] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const selectRef = useRef<HTMLSelectElement>(null)

  if (!open) return null

  function handleClose() {
    // Reset state on close
    setStep(1)
    setHazardType('')
    setSelectedIds([])
    setMessage('')
    setTotpCode('')
    setError(null)
    setSuccess(false)
    onClose()
  }

  function handleStep1Next() {
    if (!hazardType.trim()) {
      setError('Hazard type is required.')
      return
    }
    if (selectedIds.length === 0) {
      setError('Select at least one affected municipality.')
      return
    }
    if (!message.trim()) {
      setError('Message is required.')
      return
    }
    setError(null)
    setStep(2)
  }

  function handleMunicipalityChange() {
    const el = selectRef.current
    if (!el) return
    const chosen = Array.from(el.options)
      .filter((o) => o.selected)
      .map((o) => o.value)
    setSelectedIds(chosen)
  }

  async function handleConfirm() {
    setLoading(true)
    setError(null)
    try {
      await callables.declareEmergency({
        hazardType: hazardType.trim(),
        affectedMunicipalityIds: selectedIds,
        message: message.trim(),
      })
      setSuccess(true)
      setTimeout(() => {
        handleClose()
      }, 2000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const selectedNames = CAMARINES_NORTE_MUNICIPALITIES.filter((m) =>
    selectedIds.includes(m.id),
  ).map((m) => m.label)

  return (
    <div style={OVERLAY_STYLE} role="dialog" aria-modal="true" aria-label="Declare Emergency">
      <div style={MODAL_STYLE}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '18px', color: '#dc2626' }}>⚡ Declare Emergency</h2>
          <button
            onClick={handleClose}
            aria-label="Close dialog"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#666',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Step indicator */}
        <p style={{ fontSize: '12px', color: '#888', marginBottom: '16px', marginTop: 0 }}>
          Step {step} of 2 —{' '}
          {step === 1 ? 'Enter declaration details' : 'Verify identity & confirm'}
        </p>

        {step === 1 && (
          <>
            <FieldGroup label="Hazard Type *">
              <input
                style={INPUT_STYLE}
                type="text"
                placeholder="e.g. Typhoon, Flash Flood, Earthquake"
                value={hazardType}
                onChange={(e) => {
                  setHazardType(e.target.value)
                }}
                maxLength={100}
              />
            </FieldGroup>

            <FieldGroup label="Affected Municipalities * (hold Ctrl/Cmd to select multiple)">
              <select
                ref={selectRef}
                multiple
                size={8}
                style={{ ...INPUT_STYLE, height: 'auto' }}
                onChange={handleMunicipalityChange}
                value={selectedIds}
              >
                {CAMARINES_NORTE_MUNICIPALITIES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </FieldGroup>

            <FieldGroup label={`Message * (${String(message.length)}/500)`}>
              <textarea
                style={{ ...INPUT_STYLE, minHeight: '100px', resize: 'vertical' }}
                placeholder="Describe the emergency and any immediate instructions for citizens and responders."
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value)
                }}
                maxLength={500}
              />
            </FieldGroup>

            {error && <p style={ERROR_STYLE}>{error}</p>}

            <div
              style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}
            >
              <button
                onClick={handleClose}
                style={{
                  padding: '8px 16px',
                  borderRadius: '4px',
                  border: '1px solid #d0d0d0',
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleStep1Next}
                style={{
                  padding: '8px 16px',
                  borderRadius: '4px',
                  border: 'none',
                  background: '#7c3aed',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                Next: Verify Identity →
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            {/* Summary of step 1 */}
            <div
              style={{
                background: '#f9fafb',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
                padding: '12px 14px',
                marginBottom: '16px',
                fontSize: '13px',
              }}
            >
              <p style={{ margin: '0 0 6px', fontWeight: 600 }}>Declaration Summary</p>
              <p style={{ margin: '0 0 4px' }}>
                <strong>Hazard:</strong> {hazardType}
              </p>
              <p style={{ margin: '0 0 4px' }}>
                <strong>Municipalities ({selectedNames.length}):</strong> {selectedNames.join(', ')}
              </p>
              <p style={{ margin: 0 }}>
                <strong>Message:</strong>{' '}
                {message.length > 120 ? `${message.slice(0, 120)}…` : message}
              </p>
            </div>

            <FieldGroup label="TOTP Verification Code">
              <input
                style={INPUT_STYLE}
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                placeholder="6-digit code from your authenticator app"
                value={totpCode}
                onChange={(e) => {
                  setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                }}
                maxLength={6}
                autoComplete="one-time-code"
              />
              <p style={{ fontSize: '12px', color: '#666', marginTop: '4px', marginBottom: 0 }}>
                MFA is enforced server-side. If your session lacks a second factor, the server will
                reject the call regardless of the code entered here.
              </p>
            </FieldGroup>

            <div style={IMPACT_NOTE_STYLE}>
              Broadcasts FCM to all active staff · SMS to subscribed citizens in affected areas
            </div>

            {error && <p style={ERROR_STYLE}>{error}</p>}
            {success && <p style={SUCCESS_STYLE}>Emergency declared successfully. Closing…</p>}

            <div
              style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}
            >
              <button
                onClick={() => {
                  setError(null)
                  setStep(1)
                }}
                disabled={loading || success}
                style={{
                  padding: '8px 16px',
                  borderRadius: '4px',
                  border: '1px solid #d0d0d0',
                  background: '#fff',
                  cursor: loading || success ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  opacity: loading || success ? 0.6 : 1,
                }}
              >
                ← Back
              </button>
              <button
                onClick={() => void handleConfirm()}
                disabled={loading || success}
                style={{
                  padding: '8px 16px',
                  borderRadius: '4px',
                  border: 'none',
                  background: '#dc2626',
                  color: '#fff',
                  cursor: loading || success ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  opacity: loading || success ? 0.6 : 1,
                }}
              >
                {loading ? 'Declaring…' : 'Confirm & Declare Emergency'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

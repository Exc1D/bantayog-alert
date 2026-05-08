import { useState, useEffect, useRef } from 'react'

interface AlertDeclarationModalProps {
  open: boolean
  currentLevel: 'normal' | 'elevated' | 'critical'
  onClose: () => void
  onDeclare: (payload: { level: string; justification: string }) => void
}

export function AlertDeclarationModal({
  open,
  currentLevel,
  onClose,
  onDeclare,
}: AlertDeclarationModalProps) {
  const [selectedLevel, setSelectedLevel] = useState<string>('')
  const [justification, setJustification] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)

  // Reset form state when modal opens
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      setSelectedLevel('')
      setJustification('')
      setConfirmText('')
      setError('')
      // Focus the dialog when opened
      dialogRef.current?.focus()
    }
  }, [open])
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!open) return null

  const isCritical = selectedLevel === 'critical'
  const requiresJustification = isCritical
  const canSubmit =
    selectedLevel !== '' &&
    (!requiresJustification || justification.trim().length > 0) &&
    (!isCritical || confirmText === 'DECLARE')

  const handleSubmit = () => {
    if (!canSubmit) {
      if (requiresJustification && !justification.trim()) {
        setError('Justification is required for critical alerts')
      } else if (isCritical && confirmText !== 'DECLARE') {
        setError('Please type "DECLARE" to confirm')
      }
      return
    }

    onDeclare({
      level: selectedLevel,
      justification: justification.trim(),
    })
  }

  const levelLabels: Record<string, string> = {
    normal: 'Normal',
    elevated: 'Elevated',
    critical: 'Critical',
  }

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-dialog-title"
        tabIndex={-1}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose()
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onClose()
          }
        }}
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            padding: '32px',
            width: '500px',
            maxWidth: '90vw',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
          }}
        >
          <h2
            id="alert-dialog-title"
            style={{
              fontSize: '28px',
              fontWeight: 600,
              color: '#1a1a2e',
              margin: '0 0 24px 0',
            }}
          >
            Declare Alert
          </h2>

          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '18px',
                fontWeight: 500,
                color: '#495057',
                marginBottom: '8px',
              }}
            >
              Current Level: {levelLabels[currentLevel]}
            </label>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label
              htmlFor="alert-level-select"
              style={{
                display: 'block',
                fontSize: '18px',
                fontWeight: 500,
                color: '#495057',
                marginBottom: '8px',
              }}
            >
              New Level
            </label>
            <select
              id="alert-level-select"
              value={selectedLevel}
              onChange={(e) => {
                setSelectedLevel(e.target.value)
                setError('')
              }}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '18px',
                borderRadius: '6px',
                border: '1px solid #dee2e6',
              }}
            >
              <option value="">Select alert level...</option>
              <option value="normal">Normal</option>
              <option value="elevated">Elevated</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          {requiresJustification && (
            <div style={{ marginBottom: '20px' }}>
              <label
                htmlFor="justification-textarea"
                style={{
                  display: 'block',
                  fontSize: '18px',
                  fontWeight: 500,
                  color: '#a73400',
                  marginBottom: '8px',
                }}
              >
                Justification (required)
              </label>
              <textarea
                id="justification-textarea"
                value={justification}
                onChange={(e) => {
                  setJustification(e.target.value)
                  setError('')
                }}
                placeholder="Explain why this critical alert is necessary..."
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '16px',
                  borderRadius: '6px',
                  border: '1px solid #dee2e6',
                  minHeight: '100px',
                  resize: 'vertical',
                }}
              />
            </div>
          )}

          {isCritical && (
            <div style={{ marginBottom: '20px' }}>
              <label
                htmlFor="confirm-declare-input"
                style={{
                  display: 'block',
                  fontSize: '18px',
                  fontWeight: 500,
                  color: '#a73400',
                  marginBottom: '8px',
                }}
              >
                Type &quot;DECLARE&quot; to confirm
              </label>
              <input
                id="confirm-declare-input"
                type="text"
                value={confirmText}
                onChange={(e) => {
                  setConfirmText(e.target.value)
                  setError('')
                }}
                placeholder="Type DECLARE"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '18px',
                  borderRadius: '6px',
                  border: '2px solid #a73400',
                }}
              />
            </div>
          )}

          {error && (
            <p
              role="alert"
              style={{
                color: '#a73400',
                fontSize: '16px',
                marginBottom: '16px',
                padding: '8px',
                backgroundColor: '#fff3cd',
                borderRadius: '4px',
              }}
            >
              {error}
            </p>
          )}

          <div
            style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
            }}
          >
            <button
              onClick={onClose}
              style={{
                padding: '12px 24px',
                fontSize: '18px',
                borderRadius: '6px',
                border: '1px solid #dee2e6',
                backgroundColor: '#ffffff',
                color: '#495057',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{
                padding: '12px 24px',
                fontSize: '18px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: canSubmit ? '#a73400' : '#dee2e6',
                color: canSubmit ? '#ffffff' : '#6c757d',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
              }}
            >
              {isCritical ? 'Hold to Confirm' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

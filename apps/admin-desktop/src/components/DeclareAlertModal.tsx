import { useState, useCallback, useEffect, useRef } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { callables } from '../services/callables'
import { CAMARINES_NORTE_MUNICIPALITIES } from '@bantayog/shared-validators'

const HAZARD_TYPES = [
  { id: 'flood', label: 'Flood' },
  { id: 'typhoon', label: 'Typhoon' },
  { id: 'earthquake', label: 'Earthquake' },
  { id: 'fire', label: 'Fire' },
  { id: 'landslide', label: 'Landslide' },
  { id: 'volcanic_eruption', label: 'Volcanic Eruption' },
  { id: 'tsunami', label: 'Tsunami' },
  { id: 'drought', label: 'Drought' },
  { id: 'security', label: 'Security' },
  { id: 'other', label: 'Other' },
] as const

interface Props {
  open: boolean
  prefill?:
    | {
        municipalityId: string | undefined
        reportId: string | undefined
      }
    | undefined
  onClose: () => void
  onSuccess: (alertId: string) => void
  onError: (message: string) => void
}

export function DeclareAlertModal({ open, prefill, onClose, onSuccess, onError }: Props) {
  const [hazardType, setHazardType] = useState('')
  const [selectedMunicipalityIds, setSelectedMunicipalityIds] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Reset and prefill when opened
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return
    setHazardType('')
    setMessage('')
    setSubmitting(false)
    const next = new Set<string>()
    if (prefill?.municipalityId) {
      const allowedIds = new Set(CAMARINES_NORTE_MUNICIPALITIES.map((m) => m.id))
      if (allowedIds.has(prefill.municipalityId)) {
        next.add(prefill.municipalityId)
      }
    }
    setSelectedMunicipalityIds(next)
  }, [open, prefill?.municipalityId])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Focus dialog when opened
  useEffect(() => {
    if (open && dialogRef.current) {
      dialogRef.current.focus()
    }
  }, [open])

  const toggleMunicipality = useCallback((id: string) => {
    setSelectedMunicipalityIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget && !submitting) {
        onClose()
      }
    },
    [onClose, submitting],
  )

  const handleSubmit = useCallback(async () => {
    if (!hazardType || selectedMunicipalityIds.size === 0 || !message.trim()) return
    setSubmitting(true)
    try {
      const result = await callables.declareAlert({
        hazardType,
        affectedMunicipalityIds: Array.from(selectedMunicipalityIds),
        message: message.trim(),
        ...(prefill?.reportId ? { reportId: prefill.reportId } : {}),
      })
      onSuccess(result.alertId)
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to declare alert'
      onError(msg)
    } finally {
      setSubmitting(false)
    }
  }, [hazardType, selectedMunicipalityIds, message, prefill, onSuccess, onError, onClose])

  const isValid = hazardType !== '' && selectedMunicipalityIds.size > 0 && message.trim().length > 0

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-surface)]/80"
      role="presentation"
      onClick={handleBackdropClick}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !submitting) {
          onClose()
        }
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="declare-alert-title"
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-lg border border-white/10 bg-[var(--color-surface-elevated)] shadow-xl"
      >
        <div className="flex items-start justify-between border-b border-white/10 p-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-[var(--color-danger)]" />
            <h2
              id="declare-alert-title"
              className="text-lg font-semibold text-[var(--color-text-primary)]"
            >
              Declare Alert
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded p-1 hover:bg-white/10 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-[var(--color-text-secondary)]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-5">
            {/* Hazard Type */}
            <div>
              <label
                htmlFor="hazard-type"
                className="block text-sm font-medium text-[var(--color-text-secondary)]"
              >
                Hazard Type
              </label>
              <select
                id="hazard-type"
                value={hazardType}
                onChange={(e) => {
                  setHazardType(e.target.value)
                }}
                className="mt-1 w-full rounded border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
              >
                <option value="">Select hazard type</option>
                {HAZARD_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Municipalities */}
            <div>
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                Affected Municipalities
              </p>
              <div
                className="mt-2 grid grid-cols-2 gap-2"
                role="group"
                aria-label="Affected Municipalities"
              >
                {CAMARINES_NORTE_MUNICIPALITIES.map((m) => (
                  <label
                    key={m.id}
                    className="flex cursor-pointer items-center gap-2 rounded border border-white/5 bg-[var(--color-surface)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] hover:bg-white/5"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMunicipalityIds.has(m.id)}
                      onChange={() => {
                        toggleMunicipality(m.id)
                      }}
                      className="h-4 w-4 accent-[var(--color-danger)]"
                    />
                    <span className="truncate">{m.label}</span>
                  </label>
                ))}
              </div>
              {selectedMunicipalityIds.size === 0 && (
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Select at least one municipality
                </p>
              )}
            </div>

            {/* Message */}
            <div>
              <label
                htmlFor="alert-message"
                className="block text-sm font-medium text-[var(--color-text-secondary)]"
              >
                Message
              </label>
              <textarea
                id="alert-message"
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value.slice(0, 500))
                }}
                rows={4}
                placeholder="Describe the alert and any immediate advisories..."
                className="mt-1 w-full resize-none rounded border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]"
              />
              <div className="mt-1 flex justify-end">
                <span
                  className={`text-xs ${
                    message.length >= 450
                      ? 'text-[var(--color-warning)]'
                      : 'text-[var(--color-text-muted)]'
                  }`}
                >
                  {message.length}/500
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-white/10 p-6">
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-md px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-white/10 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              handleSubmit().catch((err: unknown) => {
                console.error('DeclareAlertModal handleSubmit error', err)
                const msg = err instanceof Error ? err.message : 'Failed to declare alert'
                onError(msg)
              })
            }}
            disabled={!isValid || submitting}
            className="flex items-center gap-2 rounded-md bg-[var(--color-danger)] px-4 py-2 text-sm text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)]"
          >
            {submitting && (
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}
            Declare Alert
          </button>
        </div>
      </div>
    </div>
  )
}

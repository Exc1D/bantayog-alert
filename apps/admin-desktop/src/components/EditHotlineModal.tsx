import { useCallback, useEffect, useState } from 'react'
import { Phone, RotateCw, X } from 'lucide-react'
import { doc, getDoc } from 'firebase/firestore'
import { useAuth } from '@bantayog/shared-ui'
import { db } from '../app/firebase'
import { callables } from '../services/callables'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { MUNICIPALITIES, MUNICIPALITY_ID_TO_LABEL } from './declare-alert-options'
import {
  canEditHotlines,
  normalizeHotlineForm,
  validateHotlineForm,
  type HotlineValidationErrors,
} from './hotline-form'

interface Props {
  open: boolean
  onClose: () => void
}

type LoadState = 'loading' | 'loaded' | 'error'
type SubmitState = 'idle' | 'submitting' | 'success' | 'error'

const FALLBACK_MUNICIPALITY_ID = MUNICIPALITIES[0]?.id ?? ''

interface CallableErrorLike {
  code?: unknown
}

function getCallableErrorCode(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null
  const code = (err as CallableErrorLike).code
  if (typeof code !== 'string') return null
  return code.startsWith('functions/') ? code.slice('functions/'.length) : code
}

/** Map stable callable error codes to operator-safe copy. */
function describeSubmitError(err: unknown): string {
  const code = getCallableErrorCode(err)
  if (code === 'permission-denied' || code === 'unauthenticated') {
    return 'You do not have permission to edit this hotline.'
  }
  if (code === 'resource-exhausted') {
    return 'Too many changes in a short time. Wait a minute and try again.'
  }
  if (code === 'invalid-argument') {
    return 'Check the hotline fields and try again.'
  }
  return 'Could not update the hotline. Check your connection and try again.'
}

export function EditHotlineModal({ open, onClose }: Props) {
  const { claims } = useAuth()
  const role = typeof claims?.role === 'string' ? claims.role : null
  const isSuperadmin = role === 'provincial_superadmin'
  const claimMunicipalityId =
    typeof claims?.municipalityId === 'string' ? claims.municipalityId : ''

  // Superadmins choose any municipality; municipal admins are locked to their own.
  // Derived (no effect) so there is no synchronous setState-in-effect.
  const [picked, setPicked] = useState(FALLBACK_MUNICIPALITY_ID)
  const selectedMunicipalityId = isSuperadmin ? picked : claimMunicipalityId
  const [reloadNonce, setReloadNonce] = useState(0)
  const retryHotline = useCallback(() => {
    setReloadNonce((n) => n + 1)
  }, [])

  const trapRef = useFocusTrap({ isActive: open, onEscape: onClose })

  if (!open) return null
  if (!canEditHotlines(claims)) return null

  const noMunicipalityScope = !isSuperadmin && !claimMunicipalityId

  return (
    <div
      ref={trapRef}
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-[var(--color-surface)]/80"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-hotline-title"
        aria-describedby="edit-hotline-description"
        className="flex max-h-[90vh] w-full max-w-md flex-col rounded-lg border border-white/10 bg-[var(--color-surface-elevated)] shadow-xl"
      >
        <div className="flex items-start justify-between border-b border-white/10 p-6">
          <div>
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-[var(--color-accent,var(--color-success))]" />
              <h2
                id="edit-hotline-title"
                className="text-lg font-semibold text-[var(--color-text-primary)]"
              >
                Municipality Hotline
              </h2>
            </div>
            <p
              id="edit-hotline-description"
              className="mt-1 text-xs text-[var(--color-text-muted)]"
            >
              The number citizens call when a report cannot be submitted. Changes are live
              immediately.
            </p>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-white/10" aria-label="Close">
            <X className="h-4 w-4 text-[var(--color-text-secondary)]" />
          </button>
        </div>

        {noMunicipalityScope ? (
          <div className="p-6">
            <p className="text-sm text-[var(--color-danger)]">
              Your account has no municipality assigned, so there is no hotline to edit.
            </p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="shrink-0 px-6 pt-6">
              {isSuperadmin ? (
                <div className="space-y-1.5">
                  <label
                    htmlFor="hotline-municipality"
                    className="block text-xs font-medium text-[var(--color-text-secondary)]"
                  >
                    Municipality
                  </label>
                  <select
                    id="hotline-municipality"
                    value={selectedMunicipalityId}
                    onChange={(e) => {
                      setPicked(e.target.value)
                    }}
                    className="w-full rounded-md border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                  >
                    {MUNICIPALITIES.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <span className="block text-xs font-medium text-[var(--color-text-secondary)]">
                    Municipality
                  </span>
                  <p className="rounded-md border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]">
                    {MUNICIPALITY_ID_TO_LABEL[selectedMunicipalityId] ?? selectedMunicipalityId}
                  </p>
                </div>
              )}
            </div>

            {/* Keyed remount on municipality / retry resets load+form state cleanly,
                so the only setState happens inside async callbacks (lint-safe). */}
            <HotlineEditor
              key={`${selectedMunicipalityId}:${String(reloadNonce)}`}
              municipalityId={selectedMunicipalityId}
              onClose={onClose}
              onRetry={retryHotline}
            />
          </div>
        )}
      </div>
    </div>
  )
}

interface HotlineEditorProps {
  municipalityId: string
  onClose: () => void
  onRetry: () => void
}

interface HotlineEditorState {
  loadState: LoadState
  label: string
  hotline: string
  hadContact: boolean
  errors: HotlineValidationErrors
  touched: { mdrrmoLabel?: boolean; mdrrmoHotline?: boolean }
  submitState: SubmitState
  submitError: string | null
  submitting: boolean
  canSave: boolean
  setLabel: (value: string) => void
  setHotline: (value: string) => void
  handleFieldChange: (setter: (value: string) => void) => (value: string) => void
  markTouched: (field: 'mdrrmoLabel' | 'mdrrmoHotline') => void
  handleSubmit: () => Promise<void>
}

function useHotlineEditorState(municipalityId: string, onRetry: () => void): HotlineEditorState {
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [label, setLabel] = useState('')
  const [hotline, setHotline] = useState('')
  const [prefill, setPrefill] = useState<{ label: string; hotline: string }>({
    label: '',
    hotline: '',
  })
  const [hadContact, setHadContact] = useState(false)
  const [touched, setTouched] = useState<{ mdrrmoLabel?: boolean; mdrrmoHotline?: boolean }>({})
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getDoc(doc(db, 'municipalities', municipalityId))
      .then((snap) => {
        if (!active) return
        const data = snap.exists() ? snap.data() : null
        const existingLabel = typeof data?.mdrrmoLabel === 'string' ? data.mdrrmoLabel : ''
        const existingHotline = typeof data?.mdrrmoHotline === 'string' ? data.mdrrmoHotline : ''
        setLabel(existingLabel)
        setHotline(existingHotline)
        setPrefill({ label: existingLabel, hotline: existingHotline })
        setHadContact(Boolean(existingLabel && existingHotline))
        setLoadState('loaded')
      })
      .catch((err: unknown) => {
        if (!active) return
        console.error('[EditHotlineModal] prefill read failed', err)
        setLoadState('error')
      })
    return () => {
      active = false
    }
  }, [municipalityId, onRetry])

  const normalizedValues = normalizeHotlineForm({ mdrrmoLabel: label, mdrrmoHotline: hotline })
  const errors: HotlineValidationErrors = validateHotlineForm(normalizedValues)
  const isValid = Object.keys(errors).length === 0
  const isDirty =
    normalizedValues.mdrrmoLabel !== prefill.label.trim() ||
    normalizedValues.mdrrmoHotline !== prefill.hotline.trim()
  const submitting = submitState === 'submitting'
  const canSave = loadState === 'loaded' && isValid && isDirty && !submitting

  const handleFieldChange = (setter: (value: string) => void) => (value: string) => {
    setter(value)
    if (submitState === 'success' || submitState === 'error') {
      setSubmitState('idle')
      setSubmitError(null)
    }
  }

  const markTouched = (field: 'mdrrmoLabel' | 'mdrrmoHotline') => {
    setTouched((t) => ({ ...t, [field]: true }))
  }

  async function handleSubmit() {
    setTouched({ mdrrmoLabel: true, mdrrmoHotline: true })
    const normalized = normalizeHotlineForm({ mdrrmoLabel: label, mdrrmoHotline: hotline })
    if (Object.keys(validateHotlineForm(normalized)).length > 0) {
      return
    }
    setSubmitState('submitting')
    setSubmitError(null)
    try {
      await callables.updateMunicipalityContact({
        municipalityId,
        mdrrmoLabel: normalized.mdrrmoLabel,
        mdrrmoHotline: normalized.mdrrmoHotline,
      })
      setLabel(normalized.mdrrmoLabel)
      setHotline(normalized.mdrrmoHotline)
      setPrefill({ label: normalized.mdrrmoLabel, hotline: normalized.mdrrmoHotline })
      setHadContact(true)
      setSubmitState('success')
    } catch (err: unknown) {
      setSubmitState('error')
      setSubmitError(describeSubmitError(err))
    }
  }

  return {
    loadState,
    label,
    hotline,
    hadContact,
    errors,
    touched,
    submitState,
    submitError,
    submitting,
    canSave,
    setLabel,
    setHotline,
    handleFieldChange,
    markTouched,
    handleSubmit,
  }
}

interface HotlineFormFieldsProps {
  label: string
  hotline: string
  errors: HotlineValidationErrors
  touched: { mdrrmoLabel?: boolean; mdrrmoHotline?: boolean }
  submitting: boolean
  onLabelBlur: () => void
  onHotlineBlur: () => void
  onLabelChange: (value: string) => void
  onHotlineChange: (value: string) => void
}

function HotlineFormFields({
  label,
  hotline,
  errors,
  touched,
  submitting,
  onLabelBlur,
  onHotlineBlur,
  onLabelChange,
  onHotlineChange,
}: HotlineFormFieldsProps) {
  const showLabelError = touched.mdrrmoLabel && errors.mdrrmoLabel
  const showHotlineError = touched.mdrrmoHotline && errors.mdrrmoHotline

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label
          htmlFor="hotline-label"
          className="block text-xs font-medium text-[var(--color-text-secondary)]"
        >
          Office name
        </label>
        <input
          id="hotline-label"
          type="text"
          value={label}
          maxLength={80}
          disabled={submitting}
          aria-invalid={Boolean(showLabelError)}
          aria-describedby={showLabelError ? 'hotline-label-error' : undefined}
          onChange={(e) => {
            onLabelChange(e.target.value)
          }}
          onBlur={() => {
            onLabelBlur()
          }}
          placeholder="Daet MDRRMO"
          className="w-full rounded-md border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-50"
        />
        {showLabelError && (
          <p id="hotline-label-error" className="text-xs text-[var(--color-danger)]">
            {errors.mdrrmoLabel}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="hotline-number"
          className="block text-xs font-medium text-[var(--color-text-secondary)]"
        >
          Hotline number
        </label>
        <input
          id="hotline-number"
          type="tel"
          value={hotline}
          disabled={submitting}
          aria-invalid={Boolean(showHotlineError)}
          aria-describedby={showHotlineError ? 'hotline-number-error' : undefined}
          onChange={(e) => {
            onHotlineChange(e.target.value)
          }}
          onBlur={() => {
            onHotlineBlur()
          }}
          placeholder="(054) 721-1216"
          className="w-full rounded-md border border-white/10 bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-50"
        />
        {showHotlineError && (
          <p id="hotline-number-error" className="text-xs text-[var(--color-danger)]">
            {errors.mdrrmoHotline}
          </p>
        )}
      </div>
    </div>
  )
}

interface HotlineEditorActionsProps {
  canSave: boolean
  submitting: boolean
  onClose: () => void
}

function HotlineEditorActions({ canSave, submitting, onClose }: HotlineEditorActionsProps) {
  return (
    <div className="flex justify-end gap-3 border-t border-white/10 p-6">
      <button
        type="button"
        onClick={onClose}
        disabled={submitting}
        className="rounded-md px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-white/10 disabled:opacity-50"
      >
        Close
      </button>
      <button
        type="submit"
        disabled={!canSave}
        className="flex items-center gap-2 rounded-md bg-[var(--color-success)] px-4 py-2 text-sm text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-success)]"
      >
        {submitting && (
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        )}
        {submitting ? 'Saving…' : 'Save hotline'}
      </button>
    </div>
  )
}

/**
 * Owns the load + edit lifecycle for a single municipality's hotline. Mounted with a
 * key that includes the municipality id and a retry nonce, so switching municipality
 * or retrying remounts this component with fresh "loading" state instead of resetting
 * several useState values from a parent effect.
 */
function HotlineEditor({ municipalityId, onClose, onRetry }: HotlineEditorProps) {
  const state = useHotlineEditorState(municipalityId, onRetry)
  const {
    loadState,
    label,
    hotline,
    hadContact,
    errors,
    touched,
    submitState,
    submitError,
    submitting,
    canSave,
    setLabel,
    setHotline,
    handleFieldChange,
    markTouched,
    handleSubmit,
  } = state

  return (
    <form
      className="flex flex-1 flex-col overflow-hidden"
      onSubmit={(e) => {
        e.preventDefault()
        void handleSubmit()
      }}
    >
      <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-4 pt-4">
        {loadState === 'loading' && (
          <p className="text-sm text-[var(--color-text-muted)]">Loading current hotline…</p>
        )}

        {loadState === 'error' && (
          <div className="space-y-2 rounded-md border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 p-3">
            <p className="text-sm text-[var(--color-text-primary)]">
              Could not load the current hotline.
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              <RotateCw className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        )}

        {loadState === 'loaded' && (
          <>
            {!hadContact && (
              <p className="rounded-md border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 px-3 py-2 text-xs text-[var(--color-text-secondary)]">
                No hotline set — citizens currently see the province default.
              </p>
            )}

            <HotlineFormFields
              label={label}
              hotline={hotline}
              errors={errors}
              touched={touched}
              submitting={submitting}
              onLabelBlur={() => {
                markTouched('mdrrmoLabel')
              }}
              onHotlineBlur={() => {
                markTouched('mdrrmoHotline')
              }}
              onLabelChange={handleFieldChange(setLabel)}
              onHotlineChange={handleFieldChange(setHotline)}
            />

            {submitState === 'success' && (
              <p
                role="status"
                className="rounded-md border border-[var(--color-success)]/40 bg-[var(--color-success)]/10 px-3 py-2 text-sm text-[var(--color-text-primary)]"
              >
                Hotline updated — citizens see the change immediately.
              </p>
            )}

            {submitState === 'error' && submitError && (
              <p
                role="alert"
                className="rounded-md border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-text-primary)]"
              >
                {submitError}
              </p>
            )}
          </>
        )}
      </div>

      <HotlineEditorActions canSave={canSave} submitting={submitting} onClose={onClose} />
    </form>
  )
}

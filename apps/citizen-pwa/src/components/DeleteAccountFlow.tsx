import { useState, useCallback, useEffect, useRef } from 'react'
import { requestDataErasureAndSignOut } from '../services/erasure.js'

interface Props {
  onGoodbye: () => void
}

type Step = 'idle' | 'warn' | 'confirm' | 'submitting'

export function DeleteAccountFlow({ onGoodbye }: Props) {
  const [step, setStep] = useState<Step>('idle')
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const confirmInputRef = useRef<HTMLInputElement | null>(null)

  const handleConfirm = useCallback(() => {
    void (async () => {
      setStep('submitting')
      setError(null)
      try {
        await requestDataErasureAndSignOut()
        onGoodbye()
      } catch {
        setError('Something went wrong. Your account has not been deleted. Please try again.')
        setStep('confirm')
      }
    })()
  }, [onGoodbye])

  const goIdle = useCallback(() => {
    setStep('idle')
    setTyped('')
    setError(null)
  }, [])

  // Escape key closes dialog (but not while submitting)
  useEffect(() => {
    if (step === 'idle' || step === 'submitting') return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') goIdle()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
    }
  }, [step, goIdle])

  // Focus the confirmation input when entering confirm step
  useEffect(() => {
    if (step === 'confirm') {
      confirmInputRef.current?.focus()
    }
  }, [step])

  if (step === 'idle') {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setStep('warn')
          setTyped('')
          setError(null)
        }}
        className="text-sm font-medium bg-transparent border-none p-0 cursor-pointer text-left text-danger-600"
        aria-label="Delete my account"
      >
        Delete my account
      </button>
    )
  }

  return (
    <div
      className="fixed inset-0 z-modal flex items-end sm:items-center justify-center bg-black/50"
      role="presentation"
      onClick={(e) => {
        if (step !== 'submitting' && e.target === e.currentTarget) goIdle()
      }}
    >
      {step === 'warn' ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-warn-title"
          className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-6 shadow-xl"
        >
          <h2 id="delete-warn-title" className="text-base font-bold text-surface-900 mb-3">
            Delete your account?
          </h2>
          <p className="text-sm text-surface-600 mb-2">This will permanently:</p>
          <ul className="text-sm text-surface-600 mb-4 pl-5 space-y-1 list-disc">
            <li>Remove your name, contact info, and account</li>
            <li>Anonymize your reports (they remain as public record)</li>
            <li>Sign you out immediately</li>
          </ul>
          <p className="text-sm text-surface-500 mb-6">
            This cannot be undone. Your request will be reviewed before deletion is complete.
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setStep('confirm')
                setTyped('')
                setError(null)
              }}
              className="w-full h-12 rounded-xl bg-danger-600 text-white font-semibold text-sm border-none cursor-pointer"
            >
              Yes, delete my account →
            </button>
            <button
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              type="button"
              onClick={goIdle}
              className="w-full h-12 rounded-xl bg-surface-100 text-surface-700 font-semibold text-sm border-none cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
          className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-6 shadow-xl"
        >
          <h2 id="delete-confirm-title" className="text-base font-bold text-surface-900 mb-4">
            Are you sure?
          </h2>
          <label
            htmlFor="delete-confirm"
            className="block text-sm font-medium text-surface-700 mb-2"
          >
            Type DELETE to confirm
          </label>
          <input
            id="delete-confirm"
            ref={confirmInputRef}
            placeholder="Type DELETE"
            value={typed}
            disabled={step === 'submitting'}
            onChange={(e) => {
              setTyped(e.target.value)
            }}
            autoComplete="off"
            className="w-full h-12 rounded-xl border-2 border-surface-200 px-4 text-sm font-mono focus:border-danger-500 focus:outline-none mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {error && (
            <p role="alert" className="text-xs text-danger-600 mb-4">
              {error}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={typed !== 'DELETE' || step === 'submitting'}
              onClick={handleConfirm}
              className="w-full h-12 rounded-xl bg-danger-600 text-white font-semibold text-sm border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {step === 'submitting' ? 'Deleting…' : 'Confirm deletion'}
            </button>
            <button
              type="button"
              disabled={step === 'submitting'}
              aria-busy={step === 'submitting'}
              onClick={() => {
                if (step !== 'submitting') goIdle()
              }}
              className="w-full h-12 rounded-xl bg-surface-100 text-surface-700 font-semibold text-sm border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

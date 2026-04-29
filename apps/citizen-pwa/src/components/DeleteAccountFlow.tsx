import { useState, useCallback } from 'react'
import { requestDataErasureAndSignOut } from '../services/erasure.js'

interface Props {
  onGoodbye: () => void
}

type Step = 'idle' | 'warn' | 'confirm' | 'submitting'

export function DeleteAccountFlow({ onGoodbye }: Props) {
  const [step, setStep] = useState<Step>('idle')
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)

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

  if (step === 'idle') {
    return (
      <button
        onClick={() => {
          setStep('warn')
          setTyped('')
          setError(null)
        }}
        style={{ color: 'red' }}
      >
        Delete my account
      </button>
    )
  }

  if (step === 'warn') {
    return (
      <div role="dialog" aria-modal="true" aria-labelledby="delete-warn-title">
        <h2 id="delete-warn-title">Delete your account?</h2>
        <p>This will permanently:</p>
        <ul>
          <li>Remove your name, contact info, and account</li>
          <li>Anonymize your reports (they remain as public record)</li>
          <li>Sign you out immediately</li>
        </ul>
        <p>This cannot be undone. Your request will be reviewed before deletion is complete.</p>
        <button onClick={goIdle}>Cancel</button>
        <button
          onClick={() => {
            setStep('confirm')
            setTyped('')
            setError(null)
          }}
        >
          Yes, delete my account →
        </button>
      </div>
    )
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="delete-confirm-title">
      <h2 id="delete-confirm-title">Are you sure?</h2>
      <label htmlFor="delete-confirm">Type DELETE to confirm</label>
      <input
        id="delete-confirm"
        placeholder="Type DELETE"
        value={typed}
        onChange={(e) => {
          setTyped(e.target.value)
        }}
        autoComplete="off"
      />
      {error && <p role="alert">{error}</p>}
      <button onClick={goIdle}>Cancel</button>
      <button disabled={typed !== 'DELETE' || step === 'submitting'} onClick={handleConfirm}>
        Confirm deletion
      </button>
    </div>
  )
}

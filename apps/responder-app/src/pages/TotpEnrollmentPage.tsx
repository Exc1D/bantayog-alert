import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { multiFactor, TotpMultiFactorGenerator, type TotpSecret } from 'firebase/auth'

import { auth } from '../app/firebase'
import styles from './TotpEnrollmentPage.module.css'

type Step = 'generate' | 'scan' | 'verify' | 'done'

export function TotpEnrollmentPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('generate')
  const [secret, setSecret] = useState<TotpSecret | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleGenerate = async () => {
    if (!auth.currentUser) {
      setError('You must be signed in to enroll TOTP.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const session = await multiFactor(auth.currentUser).getSession()
      const newSecret = await TotpMultiFactorGenerator.generateSecret(session)
      setSecret(newSecret)
      setStep('scan')
    } catch (err) {
      // Handle specific Firebase Auth errors
      if (err && typeof err === 'object' && 'code' in err) {
        const authErr = err as { code: string; message?: string }
        switch (authErr.code) {
          case 'auth/too-many-requests':
            setError('Too many attempts. Please wait a few minutes before trying again.')
            return
          case 'auth/network-request-failed':
            setError('Network error. Please check your connection and try again.')
            return
          case 'auth/user-disabled':
            setError('This account has been disabled. Please contact your agency administrator.')
            return
        }
      }
      setError(err instanceof Error ? err.message : 'Failed to generate secret.')
    } finally {
      setBusy(false)
    }
  }

  const handleVerify = async () => {
    if (!auth.currentUser || !secret || code.length !== 6) return
    setBusy(true)
    setError(null)
    try {
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, code)
      await multiFactor(auth.currentUser).enroll(assertion, 'Authenticator app')
      await auth.currentUser.getIdToken(true)
      setStep('done')
    } catch (err) {
      // Handle specific Firebase Auth errors
      if (err && typeof err === 'object' && 'code' in err) {
        const authErr = err as { code: string; message?: string }
        switch (authErr.code) {
          case 'auth/too-many-requests':
            setError('Too many attempts. Please wait a few minutes before trying again.')
            return
          case 'auth/network-request-failed':
            setError('Network error. Please check your connection and try again.')
            return
          case 'auth/user-disabled':
            setError('This account has been disabled. Please contact your agency administrator.')
            return
        }
      }
      setError(err instanceof Error ? err.message : 'Invalid TOTP code. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleContinue = () => {
    void navigate('/')
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>Set Up Two-Factor Authentication</h1>
      <p className={styles.subhead}>
        Two-factor authentication is required for all responders. Use an authenticator app like
        Google Authenticator or Authy.
      </p>

      {error ? (
        <div role="alert" className={styles.alert}>
          {error}
        </div>
      ) : null}

      {step === 'generate' ? (
        <div className={styles.card}>
          <p>Generate a secret key to link your authenticator app.</p>
          <button
            type="button"
            className={styles.button}
            onClick={() => void handleGenerate()}
            disabled={busy}
          >
            Generate QR Code
          </button>
        </div>
      ) : null}

      {step === 'scan' && secret ? (
        <div className={styles.card}>
          <div className={styles.qrPlaceholder}>Scan this QR code with your authenticator app</div>
          <p className={styles.secretKeyLabel}>Or enter this secret manually:</p>
          <div className={styles.secretKey}>{secret.secretKey}</div>
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              setStep('verify')
            }}
            style={{ marginTop: '16px' }}
          >
            Next
          </button>
        </div>
      ) : null}

      {step === 'verify' ? (
        <div className={styles.card}>
          <label className={styles.label} htmlFor="totp-code">
            Enter the 6-digit code from your authenticator app
          </label>
          <input
            id="totp-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            className={styles.input}
            value={code}
            onChange={(event) => {
              setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
            }}
            aria-label="6-digit code"
          />
          <button
            type="button"
            className={styles.button}
            onClick={() => void handleVerify()}
            disabled={code.length !== 6 || busy}
          >
            Verify
          </button>
        </div>
      ) : null}

      {step === 'done' ? (
        <div className={styles.card}>
          <p>
            <strong>Two-factor authentication is now enabled.</strong>
          </p>
          <p>
            Your account is now protected. If you lose access to your authenticator app, contact
            your agency administrator to reset your 2FA.
          </p>
          <button type="button" className={styles.button} onClick={handleContinue}>
            Continue
          </button>
        </div>
      ) : null}
    </main>
  )
}

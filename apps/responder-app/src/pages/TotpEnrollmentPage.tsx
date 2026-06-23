import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { multiFactor, signOut, TotpMultiFactorGenerator, type TotpSecret } from 'firebase/auth'

import { auth } from '../app/firebase'
import { createQrCodeMatrix } from '../utils/qr-code'
import styles from './TotpEnrollmentPage.module.css'

type Step = 'generate' | 'scan' | 'verify' | 'done'

const QR_QUIET_ZONE = 4

function EnrollmentQrCode({ matrix }: { matrix: boolean[][] }) {
  const moduleCount = matrix.length
  const viewBoxSize = moduleCount + QR_QUIET_ZONE * 2

  return (
    <svg
      className={styles.qrCode}
      viewBox={`0 0 ${String(viewBoxSize)} ${String(viewBoxSize)}`}
      role="img"
      aria-label="Authenticator setup QR code"
      shapeRendering="crispEdges"
    >
      <rect width={viewBoxSize} height={viewBoxSize} fill="#ffffff" />
      {matrix.flatMap((row, y) =>
        row.map((dark, x) =>
          dark ? (
            <rect
              key={`${String(x)}-${String(y)}`}
              x={x + QR_QUIET_ZONE}
              y={y + QR_QUIET_ZONE}
              width="1"
              height="1"
              fill="#000000"
            />
          ) : null,
        ),
      )}
    </svg>
  )
}

export function TotpEnrollmentPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('generate')
  const [secret, setSecret] = useState<TotpSecret | null>(null)
  const [qrMatrix, setQrMatrix] = useState<boolean[][] | null>(null)
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
      const accountName = auth.currentUser.email ?? 'Responder'
      const enrollmentUri = newSecret.generateQrCodeUrl(accountName, 'Bantayog Alert')
      const matrix = createQrCodeMatrix(enrollmentUri)
      setSecret(newSecret)
      setQrMatrix(matrix)
      setStep('scan')
    } catch (err) {
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
      setError(err instanceof Error ? err.message : 'Failed to generate the authenticator setup.')
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
      try {
        await auth.currentUser.getIdToken(true)
      } catch (refreshErr) {
        console.error('[TotpEnrollmentPage] token refresh after enrollment failed:', refreshErr)
      }
      setStep('done')
    } catch (err) {
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

  const handleSignOut = async () => {
    setBusy(true)
    setError(null)
    try {
      await signOut(auth)
      void navigate('/login', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign out. Please try again.')
      setBusy(false)
    }
  }

  const handleRestart = () => {
    setSecret(null)
    setQrMatrix(null)
    setCode('')
    setError(null)
    setStep('generate')
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
            {busy ? 'Generating…' : 'Generate QR Code'}
          </button>
          <button
            type="button"
            className={styles.textButton}
            onClick={() => void handleSignOut()}
            disabled={busy}
          >
            Sign out
          </button>
        </div>
      ) : null}

      {step === 'scan' && secret && qrMatrix ? (
        <div className={styles.card}>
          <figure className={styles.qrFigure}>
            <EnrollmentQrCode matrix={qrMatrix} />
            <figcaption>Scan this QR code with your authenticator app.</figcaption>
          </figure>
          <p className={styles.secretKeyLabel}>Cannot scan? Enter this secret manually:</p>
          <div className={styles.secretKey}>{secret.secretKey}</div>
          <div className={styles.actionStack}>
            <button
              type="button"
              className={styles.button}
              onClick={() => {
                setStep('verify')
              }}
              disabled={busy}
            >
              Next
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handleRestart}
              disabled={busy}
            >
              Start over
            </button>
            <button
              type="button"
              className={styles.textButton}
              onClick={() => void handleSignOut()}
              disabled={busy}
            >
              Sign out
            </button>
          </div>
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
          <div className={styles.actionStack}>
            <button
              type="button"
              className={styles.button}
              onClick={() => void handleVerify()}
              disabled={code.length !== 6 || busy}
            >
              {busy ? 'Verifying…' : 'Verify'}
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => {
                setError(null)
                setStep('scan')
              }}
              disabled={busy}
            >
              Back
            </button>
            <button
              type="button"
              className={styles.textButton}
              onClick={() => void handleSignOut()}
              disabled={busy}
            >
              Sign out
            </button>
          </div>
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

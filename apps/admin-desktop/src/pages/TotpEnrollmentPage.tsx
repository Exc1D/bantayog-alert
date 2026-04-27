import { useState } from 'react'
import { getAuth, multiFactor, TotpMultiFactorGenerator } from 'firebase/auth'
import type { TotpSecret } from 'firebase/auth'

export function TotpEnrollmentPage() {
  const auth = getAuth()
  const [totpSecret, setTotpSecret] = useState<TotpSecret | null>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [enrolled, setEnrolled] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setError(null)
    const user = auth.currentUser
    if (!user) {
      setError('You must be logged in to enroll TOTP.')
      return
    }
    try {
      const session = await multiFactor(user).getSession()
      const secret = await TotpMultiFactorGenerator.generateSecret(session)
      setTotpSecret(secret)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate secret')
    }
  }

  async function handleEnroll() {
    setError(null)
    const user = auth.currentUser
    if (!user || !totpSecret) return
    try {
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(
        totpSecret,
        verificationCode,
      )
      await multiFactor(user).enroll(assertion, 'Authenticator')
      setEnrolled(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enrollment failed')
    }
  }

  if (enrolled) return <p>TOTP enrolled successfully.</p>

  return (
    <div>
      <h1>Enroll TOTP Authenticator</h1>
      {!totpSecret ? (
        <button onClick={() => void handleGenerate()}>Generate Secret</button>
      ) : (
        <>
          <p>
            Secret key: <code>{totpSecret.secretKey}</code>
          </p>
          <p>
            QR URI:{' '}
            <code>
              {totpSecret.generateQrCodeUrl('Bantayog Alert', auth.currentUser?.email ?? 'admin')}
            </code>
          </p>
          <input
            placeholder="6-digit code"
            value={verificationCode}
            onChange={(e) => {
              setVerificationCode(e.target.value)
            }}
          />
          <button onClick={() => void handleEnroll()}>Verify and Enroll</button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}

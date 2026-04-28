import { useState } from 'react'
import { getAuth, multiFactor, TotpMultiFactorGenerator } from 'firebase/auth'
import type { TotpSecret } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'

function generateRecoveryCodes(): string[] {
  return Array.from({ length: 8 }, () => {
    const bytes = crypto.getRandomValues(new Uint8Array(5))
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  })
}

function downloadCodes(codes: string[]) {
  const content = 'Bantayog Alert — TOTP Recovery Codes\n\n' + codes.join('\n')
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'bantayog-recovery-codes.txt'
  a.click()
  URL.revokeObjectURL(url)
}

type Step = 1 | 2 | 3

export function TotpEnrollmentPage() {
  const auth = getAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>(1)
  const [totpSecret, setTotpSecret] = useState<TotpSecret | null>(null)
  const [qrUri, setQrUri] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // Generated once when entering step 3 — empty until then
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])

  // Step 1 loads: generate session + secret
  async function handleStart() {
    setError(null)
    setLoading(true)
    const user = auth.currentUser
    if (!user) {
      setError('You must be logged in to enroll TOTP.')
      setLoading(false)
      return
    }
    try {
      const session = await multiFactor(user).getSession()
      const secret = await TotpMultiFactorGenerator.generateSecret(session)
      const uri = secret.generateQrCodeUrl('Bantayog Alert', user.email ?? 'admin')
      setTotpSecret(secret)
      setQrUri(uri)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate secret')
    } finally {
      setLoading(false)
    }
  }

  async function handleEnroll() {
    if (!totpSecret) return
    setError(null)
    setLoading(true)
    const user = auth.currentUser
    if (!user) {
      setError('Session expired. Please reload and try again.')
      setLoading(false)
      return
    }
    try {
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(
        totpSecret,
        verificationCode,
      )
      await multiFactor(user).enroll(assertion, 'Authenticator')
      // Generate recovery codes once on successful enrollment
      setRecoveryCodes(generateRecoveryCodes())
      setStep(3)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Enrollment failed. Check your code and try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  const containerStyle: React.CSSProperties = {
    maxWidth: 480,
    margin: '48px auto',
    padding: '32px',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    fontFamily: 'system-ui, sans-serif',
  }

  const headingStyle: React.CSSProperties = {
    fontSize: 20,
    fontWeight: 600,
    marginBottom: 8,
    color: '#111827',
  }

  const subStyle: React.CSSProperties = {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
  }

  const btnPrimary: React.CSSProperties = {
    padding: '10px 20px',
    background: '#1d4ed8',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    minWidth: 140,
  }

  const btnSecondary: React.CSSProperties = {
    padding: '10px 20px',
    background: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    minWidth: 100,
  }

  const inputStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontSize: 20,
    letterSpacing: '0.3em',
    textAlign: 'center',
    marginBottom: 16,
    boxSizing: 'border-box',
  }

  const stepIndicator = (
    <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
      {([1, 2, 3] as const).map((s) => (
        <div
          key={s}
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: step >= s ? '#1d4ed8' : '#e5e7eb',
            color: step >= s ? '#fff' : '#9ca3af',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {s}
        </div>
      ))}
      <span style={{ fontSize: 13, color: '#6b7280', alignSelf: 'center', marginLeft: 4 }}>
        {step === 1 && 'Scan QR Code'}
        {step === 2 && 'Verify Code'}
        {step === 3 && 'Save Recovery Codes'}
      </span>
    </div>
  )

  // ── Step 1 ────────────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <main style={containerStyle}>
        {stepIndicator}
        <h1 style={headingStyle}>Set Up Two-Factor Authentication</h1>
        <p style={subStyle}>
          Scan the QR code below with your authenticator app (Google Authenticator, Authy, etc.),
          then click Next.
        </p>

        {!totpSecret && (
          <button style={btnPrimary} disabled={loading} onClick={() => void handleStart()}>
            {loading ? 'Generating...' : 'Generate QR Code'}
          </button>
        )}

        {totpSecret && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <QRCodeSVG value={qrUri} size={200} />
            </div>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>
              Can&apos;t scan? Enter this key manually:
            </p>
            <code
              style={{
                display: 'block',
                background: '#f3f4f6',
                padding: '8px 12px',
                borderRadius: 4,
                fontSize: 13,
                wordBreak: 'break-all',
                marginBottom: 24,
                color: '#111827',
              }}
            >
              {totpSecret.secretKey}
            </code>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                style={btnPrimary}
                onClick={() => {
                  setStep(2)
                }}
              >
                Next
              </button>
            </div>
          </>
        )}

        {error && (
          <p role="alert" style={{ color: '#b91c1c', fontSize: 13, marginTop: 12 }}>
            {error}
          </p>
        )}
      </main>
    )
  }

  // ── Step 2 ────────────────────────────────────────────────────────────────
  if (step === 2) {
    return (
      <main style={containerStyle}>
        {stepIndicator}
        <h1 style={headingStyle}>Enter Verification Code</h1>
        <p style={subStyle}>
          Open your authenticator app and enter the 6-digit code shown for Bantayog Alert.
        </p>

        <label
          htmlFor="totp-code"
          style={{ fontSize: 13, color: '#374151', display: 'block', marginBottom: 6 }}
        >
          6-digit code
        </label>
        <input
          id="totp-code"
          type="tel"
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          value={verificationCode}
          style={inputStyle}
          onChange={(e) => {
            setVerificationCode(e.target.value.replace(/\D/g, ''))
          }}
        />

        {error && (
          <p role="alert" style={{ color: '#b91c1c', fontSize: 13, marginBottom: 12 }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
          <button
            style={btnSecondary}
            onClick={() => {
              setError(null)
              setStep(1)
            }}
          >
            Back
          </button>
          <button
            style={btnPrimary}
            disabled={loading || verificationCode.length !== 6}
            onClick={() => void handleEnroll()}
          >
            {loading ? 'Verifying...' : 'Verify and Enroll'}
          </button>
        </div>
      </main>
    )
  }

  // ── Step 3 ────────────────────────────────────────────────────────────────
  return (
    <main style={containerStyle}>
      {stepIndicator}
      <h1 style={headingStyle}>Save Your Recovery Codes</h1>
      <p style={subStyle}>
        Store these codes somewhere safe. Each code can be used once to regain access if you lose
        your authenticator device.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          marginBottom: 20,
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          padding: 16,
        }}
      >
        {recoveryCodes.map((code) => (
          <code
            key={code}
            style={{
              fontFamily: 'monospace',
              fontSize: 14,
              color: '#111827',
              letterSpacing: '0.1em',
            }}
          >
            {code}
          </code>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, flexDirection: 'column' }}>
        <button
          style={btnSecondary}
          onClick={() => {
            downloadCodes(recoveryCodes)
          }}
        >
          Download as Text
        </button>
        <button
          style={btnPrimary}
          onClick={() => {
            void navigate('/province/dashboard')
          }}
        >
          I&apos;ve saved my codes — Continue to Dashboard
        </button>
      </div>
    </main>
  )
}

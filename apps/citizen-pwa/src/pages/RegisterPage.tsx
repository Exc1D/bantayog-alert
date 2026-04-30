import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { linkWithPhoneNumber, RecaptchaVerifier, updateProfile } from 'firebase/auth'
import { auth } from '../services/firebase.js'
import { useToast } from '../hooks/useToast.js'
import { Toast } from '../components/Toast.js'

type Step = 'phone' | 'otp' | 'name'

export function RegisterPage() {
  const navigate = useNavigate()
  const { show, message, type, toast } = useToast()

  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('+63')
  const [otp, setOtp] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmationResult, setConfirmationResult] = useState<{
    confirm: (code: string) => Promise<unknown>
  } | null>(null)
  const [verifier, setVerifier] = useState<RecaptchaVerifier | null>(null)

  useEffect(() => {
    return () => {
      verifier?.clear()
    }
  }, [verifier])

  const handleSendOtp = useCallback(async () => {
    let firebaseAuth
    try {
      firebaseAuth = auth()
    } catch {
      toast('Authentication unavailable', 'error')
      return
    }
    const currentUser = firebaseAuth.currentUser
    if (!currentUser) {
      toast('Not signed in', 'error')
      return
    }
    setLoading(true)
    try {
      const recaptchaVerifier = new RecaptchaVerifier(firebaseAuth, 'recaptcha-container', {
        size: 'invisible',
      })
      setVerifier(recaptchaVerifier)
      const result = await linkWithPhoneNumber(currentUser, phone, recaptchaVerifier)
      setConfirmationResult({ confirm: (code: string) => result.confirm(code) })
      setStep('otp')
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to send OTP', 'error')
    } finally {
      setLoading(false)
    }
  }, [phone, toast])

  const handleVerifyOtp = useCallback(async () => {
    if (!confirmationResult) return
    setLoading(true)
    try {
      await confirmationResult.confirm(otp)
      setStep('name')
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Invalid OTP', 'error')
    } finally {
      setLoading(false)
    }
  }, [confirmationResult, otp, toast])

  const handleSaveName = useCallback(async () => {
    let firebaseAuth
    try {
      firebaseAuth = auth()
    } catch {
      toast('Authentication unavailable', 'error')
      return
    }
    const currentUser = firebaseAuth.currentUser
    if (!currentUser) {
      toast('Not signed in', 'error')
      return
    }
    setLoading(true)
    try {
      await updateProfile(currentUser, { displayName })
      void navigate('/', { replace: true })
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to save name', 'error')
    } finally {
      setLoading(false)
    }
  }, [displayName, navigate, toast])

  return (
    <div style={{ minHeight: '100dvh', background: '#f5f7fa' }}>
      <div
        style={{
          background: '#001e40',
          color: '#fff',
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          type="button"
          onClick={() => {
            void navigate(-1)
          }}
          style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
          aria-label="Go back"
        >
          <ArrowLeft size={20} color="#fff" />
        </button>
        <h1 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800 }}>Register</h1>
      </div>

      <div id="recaptcha-container" />

      <div style={{ padding: '24px 16px' }}>
        {step === 'phone' && (
          <div>
            <p
              style={{
                margin: '0 0 16px',
                fontSize: '0.9375rem',
                fontWeight: 600,
                color: '#001e40',
              }}
            >
              Enter your phone number
            </p>
            <input
              type="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value)
              }}
              placeholder="+63XXXXXXXXXX"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                fontSize: '1rem',
                marginBottom: 16,
                boxSizing: 'border-box',
              }}
            />
            <button
              type="button"
              onClick={() => {
                void handleSendOtp()
              }}
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                border: 'none',
                borderRadius: 999,
                background: '#f26522',
                color: '#fff',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Sending…' : 'Send OTP'}
            </button>
          </div>
        )}

        {step === 'otp' && (
          <div>
            <p
              style={{
                margin: '0 0 16px',
                fontSize: '0.9375rem',
                fontWeight: 600,
                color: '#001e40',
              }}
            >
              Enter the 6-digit code sent to {phone}
            </p>
            <input
              type="text"
              value={otp}
              onChange={(e) => {
                setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
              }}
              maxLength={6}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                fontSize: '1.5rem',
                textAlign: 'center',
                letterSpacing: '0.3em',
                marginBottom: 16,
                boxSizing: 'border-box',
              }}
            />
            <button
              type="button"
              onClick={() => {
                void handleVerifyOtp()
              }}
              disabled={loading || otp.length < 6}
              style={{
                width: '100%',
                padding: '14px',
                border: 'none',
                borderRadius: 999,
                background: '#f26522',
                color: '#fff',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading || otp.length < 6 ? 0.7 : 1,
              }}
            >
              {loading ? 'Verifying…' : 'Verify'}
            </button>
          </div>
        )}

        {step === 'name' && (
          <div>
            <p
              style={{
                margin: '0 0 16px',
                fontSize: '0.9375rem',
                fontWeight: 600,
                color: '#001e40',
              }}
            >
              What should we call you?
            </p>
            <input
              type="text"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value)
              }}
              placeholder="Your name"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                fontSize: '1rem',
                marginBottom: 16,
                boxSizing: 'border-box',
              }}
            />
            <button
              type="button"
              onClick={() => {
                void handleSaveName()
              }}
              disabled={loading || !displayName.trim()}
              style={{
                width: '100%',
                padding: '14px',
                border: 'none',
                borderRadius: 999,
                background: '#f26522',
                color: '#fff',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading || !displayName.trim() ? 0.7 : 1,
              }}
            >
              {loading ? 'Saving…' : 'Complete Registration'}
            </button>
          </div>
        )}
      </div>

      <Toast show={show} message={message} type={type} />
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone } from 'lucide-react'
import {
  signInWithPhoneNumber,
  RecaptchaVerifier,
  PhoneAuthProvider,
  signInWithCredential,
} from 'firebase/auth'
import { useToast } from '../hooks/useToast.js'
import { Toast } from '../components/Toast.js'
import { auth, hasFirebaseConfig } from '../services/firebase.js'
import { getStoredPhone, setStoredPhone } from '../services/phone-session-storage.js'

export function LoginPage() {
  const navigate = useNavigate()
  const { show, message, type, toast } = useToast()
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  // Seed from sessionStorage so users who bounce between /login and /register
  // (e.g. wrong-account → register flow) keep the phone they already typed.
  const [phone, setPhone] = useState(() => getStoredPhone())
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [verificationId, setVerificationId] = useState<string | null>(null)
  const recaptchaContainerRef = useRef<HTMLDivElement>(null)
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initialize invisible reCAPTCHA
  useEffect(() => {
    if (!hasFirebaseConfig() || !recaptchaContainerRef.current) return

    try {
      const verifier = new RecaptchaVerifier(auth(), 'recaptcha-verifier', {
        size: 'invisible',
      })
      recaptchaVerifierRef.current = verifier
    } catch (error) {
      console.error('Failed to initialize RecaptchaVerifier:', error)
    }

    return () => {
      recaptchaVerifierRef.current?.clear()
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const PH_MOBILE_REGEX = /^\+63[89]\d{9}$/

  const handlePhoneSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()

    const normalizedPhone = phone.replace(/\s/g, '')
    if (!PH_MOBILE_REGEX.test(normalizedPhone)) {
      toast('Please enter a valid Philippine mobile number', 'error')
      return
    }

    if (!hasFirebaseConfig()) {
      toast('Firebase configuration missing', 'error')
      return
    }

    if (!recaptchaVerifierRef.current) {
      toast('Failed to initialize reCAPTCHA', 'error')
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const confirmationResult = await signInWithPhoneNumber(
        auth(),
        normalizedPhone,
        recaptchaVerifierRef.current,
      )
      setVerificationId(confirmationResult.verificationId)
      setStep('otp')
    } catch (error) {
      console.error('SMS send error:', error)
      toast(error instanceof Error ? error.message : 'Failed to send verification code', 'error')
      recaptchaVerifierRef.current.clear()
      recaptchaVerifierRef.current = null
    } finally {
      setLoading(false)
    }
  }

  const handleOtpSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!verificationId || otp.length !== 6) {
      toast('Please enter the 6-digit code', 'error')
      return
    }

    setLoading(true)
    try {
      const credential = PhoneAuthProvider.credential(verificationId, otp)
      await signInWithCredential(auth(), credential)
      toast('Signed in successfully', 'success')
      timeoutRef.current = setTimeout(() => void navigate('/profile'), 500)
    } catch (error) {
      console.error('OTP verification error:', error)
      toast(error instanceof Error ? error.message : 'Invalid verification code', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] bg-surface-100">
      {/* Back header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b bg-white border-surface-200">
        <button
          type="button"
          onClick={() => void navigate(-1)}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border-none bg-transparent cursor-pointer"
          aria-label="Go back"
        >
          <ArrowLeft size={20} className="text-surface-900" />
        </button>
        <h1 className="m-0 font-semibold text-lg text-surface-900">Sign In</h1>
      </div>

      <div className="p-6 max-w-md mx-auto">
        {step === 'phone' ? (
          <>
            <div className="mb-6">
              <p className="text-sm text-surface-600">
                Enter your phone number to sign in to your account.
              </p>
            </div>
            <form
              id="login-phone-form"
              name="login-phone-form"
              onSubmit={(e) => void handlePhoneSubmit(e)}
            >
              <label htmlFor="login-phone" className="sr-only">
                Phone number
              </label>
              <div className="relative mb-4">
                <Phone
                  size={20}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400"
                  aria-hidden="true"
                />
                <input
                  id="login-phone"
                  name="phone"
                  autoComplete="tel"
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    const next = e.target.value
                    setPhone(next)
                    setStoredPhone(next)
                  }}
                  placeholder="+63 XXX XXX XXXX"
                  className="w-full pl-10 pr-4 py-3 border border-surface-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              >
                {loading ? 'Sending...' : 'Continue'}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="mb-6">
              <p className="text-sm text-surface-600 mb-2">
                Enter the 6-digit code sent to your phone.
              </p>
              <p className="text-xs text-surface-500">{phone}</p>
            </div>
            <form
              id="login-otp-form"
              name="login-otp-form"
              onSubmit={(e) => void handleOtpSubmit(e)}
            >
              <label htmlFor="login-otp" className="sr-only">
                Verification code
              </label>
              <input
                id="login-otp"
                name="otp"
                autoComplete="one-time-code"
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 6)
                  setOtp(digits)
                }}
                placeholder="000000"
                className="w-full px-4 py-3 text-center text-2xl tracking-widest border border-surface-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none mb-4"
                disabled={loading}
                maxLength={6}
              />
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full py-3 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              >
                {loading ? 'Verifying...' : 'Sign In'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep('phone')
                  setOtp('')
                }}
                className="w-full py-3 mt-2 text-sm font-medium text-surface-600 hover:text-surface-900 bg-transparent border-none cursor-pointer"
              >
                Change phone number
              </button>
            </form>
          </>
        )}

        {/* Invisible reCAPTCHA container */}
        <div id="recaptcha-verifier" ref={recaptchaContainerRef} className="sr-only" />
      </div>

      <Toast show={show} message={message} type={type} />
    </div>
  )
}

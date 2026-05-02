import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { linkWithPhoneNumber, RecaptchaVerifier, updateProfile } from 'firebase/auth'
import { auth } from '../services/firebase.js'
import { registerCitizen } from '../services/callables.js'
import { useToast } from '../hooks/useToast.js'
import { Toast } from '../components/Toast.js'
import { getStoredPhone, setStoredPhone } from '../services/phone-session-storage.js'

type Step = 'phone' | 'otp' | 'name' | 'consent'

const STEPS: Step[] = ['phone', 'otp', 'name', 'consent']

export function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { show, message, type, toast } = useToast()
  const isResume = searchParams.get('resume') === 'registration'

  const [step, setStep] = useState<Step>(isResume ? 'consent' : 'phone')
  // Seed from sessionStorage so users who bounce here from /login (or back)
  // do not have to retype the +63 prefix. The resume effect below still
  // overrides this with `currentUser.phoneNumber` when applicable.
  const [phone, setPhone] = useState(() => {
    if (isResume) return '+63'
    return getStoredPhone()
  })
  const [otp, setOtp] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [consentGiven, setConsentGiven] = useState(false)
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

  // Pre-populate the displayName if the user already has one (e.g. they
  // completed `updateProfile` but not `registerCitizen` last time).
  useEffect(() => {
    if (!isResume) return
    let u
    try {
      u = auth().currentUser
    } catch {
      return
    }
    if (!u) return
    if (u.displayName) setDisplayName(u.displayName) // eslint-disable-line react-hooks/set-state-in-effect
    if (u.phoneNumber) setPhone(u.phoneNumber)
  }, [isResume])

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
      setStep('consent')
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Failed to save name', 'error')
    } finally {
      setLoading(false)
    }
  }, [displayName, toast])

  const handleConsent = useCallback(async () => {
    if (!consentGiven) return
    setLoading(true)
    try {
      await registerCitizen()
      toast('Welcome to Bantayog Alert', 'success')
      void navigate('/', { replace: true })
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Registration failed', 'error')
    } finally {
      setLoading(false)
    }
  }, [consentGiven, navigate, toast])

  const ctaGradient = { background: 'linear-gradient(135deg, #0f9488, #0d7377)' }

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col relative">
      <button
        type="button"
        onClick={() => {
          void navigate(-1)
        }}
        className="absolute top-4 left-4 p-1"
        aria-label="Go back"
      >
        <ArrowLeft size={20} className="text-[#001e40]" />
      </button>

      <h1 className="text-center text-2xl font-bold text-[#001e40] pt-14 pb-2">Register</h1>

      <div id="recaptcha-container" />

      <div className="flex flex-col flex-1 px-4 pt-16 pb-8">
        {/* Step indicator dots */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {STEPS.map((s) => (
            <div
              key={s}
              className={
                step === s
                  ? 'w-6 h-2 bg-[#0f9488] rounded-full'
                  : 'w-2 h-2 bg-[#d5dedd] rounded-full'
              }
            />
          ))}
        </div>

        {step === 'phone' && (
          <div>
            <label
              htmlFor="register-phone"
              className="mb-4 text-[0.9375rem] font-semibold text-[#001e40] block"
            >
              Enter your phone number
            </label>
            <input
              id="register-phone"
              name="phone"
              autoComplete="tel"
              type="tel"
              value={phone}
              onChange={(e) => {
                const next = e.target.value
                setPhone(next)
                setStoredPhone(next)
              }}
              placeholder="+63XXXXXXXXXX"
              className="w-full h-14 rounded-xl border border-[#d5dedd] px-4 text-base focus:border-[#0f9488] focus:outline-none mb-4"
            />
            <button
              type="button"
              onClick={() => {
                void handleSendOtp()
              }}
              disabled={loading}
              style={ctaGradient}
              className="w-full h-14 rounded-xl text-white font-semibold text-base disabled:opacity-70"
            >
              {loading ? 'Sending…' : 'Send OTP'}
            </button>
          </div>
        )}

        {step === 'otp' && (
          <div>
            <p className="mb-4 text-[0.9375rem] font-semibold text-[#001e40]">
              Enter the 6-digit code sent to {phone}
            </p>
            <input
              type="text"
              value={otp}
              onChange={(e) => {
                setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
              }}
              maxLength={6}
              className="w-full text-center font-mono text-2xl tracking-[0.5em] h-14 rounded-xl border border-[#d5dedd] focus:border-[#0f9488] focus:outline-none mb-4"
            />
            <button
              type="button"
              onClick={() => {
                void handleVerifyOtp()
              }}
              disabled={loading || otp.length < 6}
              style={ctaGradient}
              className="w-full h-14 rounded-xl text-white font-semibold text-base disabled:opacity-70"
            >
              {loading ? 'Verifying…' : 'Verify'}
            </button>
          </div>
        )}

        {step === 'name' && (
          <div>
            <p className="mb-4 text-[0.9375rem] font-semibold text-[#001e40]">
              What should we call you?
            </p>
            <input
              type="text"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value)
              }}
              placeholder="Your name"
              className="w-full h-14 rounded-xl border border-[#d5dedd] px-4 text-base focus:border-[#0f9488] focus:outline-none mb-4"
            />
            <button
              type="button"
              onClick={() => {
                void handleSaveName()
              }}
              disabled={loading || !displayName.trim()}
              style={ctaGradient}
              className="w-full h-14 rounded-xl text-white font-semibold text-base disabled:opacity-70"
            >
              {loading ? 'Saving…' : 'Complete Registration'}
            </button>
          </div>
        )}

        {step === 'consent' && (
          <div>
            <p className="mb-4 text-[0.9375rem] font-semibold text-[#001e40]">
              Your previous reports are already linked to this account.
            </p>
            <p className="mb-1 text-[0.6875rem] text-[#7b8794] italic">
              Nakakonekta na ang iyong mga naunang ulat sa account na ito.
            </p>
            <div className="my-4 p-3 rounded-xl bg-[#f2f4f6]">
              <p className="mb-2 text-[0.8125rem] font-semibold text-[#001e40]">Privacy Notice</p>
              <p className="text-xs text-[#52606d] leading-relaxed">
                Your data is processed under RA 10173 (Data Privacy Act of 2012). We collect only
                what is necessary to process your reports and keep you informed. You may request
                data deletion at any time.
              </p>
              <p className="mt-1 text-[0.6875rem] text-[#7b8794] italic">
                Ang iyong datos ay pinoproseso ayon sa RA 10173. Kinokolekta lamang ang kailangan
                para sa iyong mga ulat.
              </p>
            </div>
            <label className="flex gap-2 items-start mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={consentGiven}
                onChange={(e) => {
                  setConsentGiven(e.target.checked)
                }}
                className="mt-0.5"
              />
              <span className="text-[0.8125rem] text-[#001e40]">
                I have read and agree to the Terms of Use and Privacy Notice
              </span>
            </label>
            <button
              type="button"
              onClick={() => {
                void handleConsent()
              }}
              disabled={!consentGiven}
              style={ctaGradient}
              className="w-full h-14 rounded-xl text-white font-semibold text-base disabled:opacity-70"
            >
              Create Account
            </button>
          </div>
        )}
      </div>

      <Toast show={show} message={message} type={type} />
    </div>
  )
}

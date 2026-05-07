import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { cn } from '@/lib/utils'
import { Shield, Lock, Loader2, Check } from 'lucide-react'
import { auth } from '../app/firebase'

type LoginStep = 'phone' | 'otp' | 'totp' | 'complete'

const PARTICLES = Array.from({ length: 20 }).map(() => ({
  left: `${String(Math.random() * 100)}%`,
  top: `${String(Math.random() * 100)}%`,
  dur: `${String(3 + Math.random() * 4)}s`,
  delay: `${String(Math.random() * 5)}s`,
}))

export default function LoginPage() {
  const navigate = useNavigate()
  const [loginStep, setLoginStep] = useState<LoginStep>('phone')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [phone, setPhone] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', ''])
  const [totpCode, setTotpCode] = useState(['', '', '', '', '', ''])
  const [otpCooldown, setOtpCooldown] = useState(0)
  const [totpTimer, setTotpTimer] = useState(30)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])
  const totpRefs = useRef<(HTMLInputElement | null)[]>([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (loginStep !== 'totp' && loginStep !== 'complete') return
    const interval = setInterval(() => {
      setTotpTimer((t) => (t <= 1 ? 30 : t - 1))
    }, 1000)
    return () => {
      clearInterval(interval)
    }
  }, [loginStep])

  useEffect(() => {
    if (otpCooldown <= 0) return
    const interval = setInterval(() => {
      setOtpCooldown((c) => c - 1)
    }, 1000)
    return () => {
      clearInterval(interval)
    }
  }, [otpCooldown])

  const handleSendOtp = () => {
    if (phone.length < 10) {
      setLoginError('Please enter a valid Philippine phone number')
      return
    }
    setLoginError(null)
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      setOtpSent(true)
      setOtpCooldown(60)
      setLoginStep('otp')
      otpRefs.current[0]?.focus()
    }, 1500)
  }

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return
    const newOtp = [...otpCode]
    newOtp[index] = value
    setOtpCode(newOtp)
    setLoginError(null)
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus()
    }
    if (newOtp.every((d) => d !== '')) {
      setTimeout(() => {
        setLoginStep('totp')
        setTimeout(() => totpRefs.current[0]?.focus(), 100)
      }, 300)
    }
  }

  const handleTotpChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return
    const newTotp = [...totpCode]
    newTotp[index] = value
    setTotpCode(newTotp)
    setLoginError(null)
    if (value && index < 5) {
      totpRefs.current[index + 1]?.focus()
    }
    if (newTotp.every((d) => d !== '')) {
      setIsLoading(true)
      setTimeout(() => {
        setIsLoading(false)
        setLoginStep('complete')
        void navigate('/dashboard')
      }, 800)
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent, type: 'otp' | 'totp') => {
    if (e.key === 'Backspace') {
      const arr = type === 'otp' ? otpCode : totpCode
      if (!arr[index] && index > 0) {
        const refs = type === 'otp' ? otpRefs : totpRefs
        refs.current[index - 1]?.focus()
      }
    }
    if (e.key === 'Enter') {
      if (type === 'otp' && otpCode.every((d) => d !== '')) {
        setLoginStep('totp')
      }
    }
  }

  const handlePaste = (e: React.ClipboardEvent, type: 'otp' | 'totp') => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      const arr = pasted.split('')
      if (type === 'otp') {
        setOtpCode(arr)
        setTimeout(() => {
          setLoginStep('totp')
        }, 300)
      } else {
        setTotpCode(arr)
        setIsLoading(true)
        setTimeout(() => {
          setIsLoading(false)
          setLoginStep('complete')
          void navigate('/dashboard')
        }, 800)
      }
    }
  }

  const handleEmailLogin = async () => {
    if (!email || !password) {
      setLoginError('Please enter email and password')
      return
    }
    setLoginError(null)
    setIsLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      void navigate('/dashboard')
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] bg-white relative flex items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d64933' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {PARTICLES.map((p, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-accent rounded-full opacity-20"
            style={{
              left: p.left,
              top: p.top,
              animation: `pulse-soft ${p.dur} ease-in-out infinite`,
              animationDelay: p.delay,
            }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
        className="relative z-10 w-full max-w-[420px] mx-4"
      >
        <div className="bg-white border border-border rounded-xl p-8 shadow-lg">
          <div className="flex flex-col items-center">
            <BantayogLogo className="w-16 h-16" />
            <h1 className="text-xl font-semibold text-foreground mt-4">Bantayog Alert</h1>
            <p className="text-sm text-muted-foreground mt-2">Superadmin Access Portal</p>
            <div className="flex items-center gap-1.5 mt-3 text-muted-foreground/70">
              <Shield className="w-3.5 h-3.5" />
              <span className="text-xs">End-to-end encrypted</span>
            </div>
          </div>

          {loginError && (
            <motion.div
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700"
            >
              {loginError}
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {(loginStep === 'phone' || loginStep === 'otp') && (
              <motion.div
                key="phone-step"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="mt-6"
              >
                <div className="block text-sm text-muted-foreground mb-2" id="phone-label">
                  Phone Number
                </div>
                <div
                  className="flex items-center bg-white border border-border rounded-md px-3 py-2.5 focus-within:border-accent focus-within:shadow-[0_0_0_2px_rgba(214,73,51,0.15)] transition-all"
                  role="group"
                  aria-labelledby="phone-label"
                >
                  <span className="text-base text-muted-foreground mr-2 select-none">+63</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10)
                      setPhone(val)
                      setLoginError(null)
                    }}
                    placeholder="9XX XXX XXXX"
                    className="bg-transparent text-base text-foreground w-full outline-none placeholder:text-muted-foreground/70"
                    disabled={otpSent}
                  />
                </div>

                {!otpSent ? (
                  <button
                    onClick={handleSendOtp}
                    disabled={isLoading}
                    className="w-full mt-3 bg-accent text-white py-2.5 rounded-md text-sm font-medium hover:brightness-110 active:brightness-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {isLoading ? 'Sending...' : 'Send OTP'}
                  </button>
                ) : (
                  <div className="mt-3 flex items-center gap-2 text-green-700 text-sm">
                    <Check className="w-4 h-4" />
                    <span>OTP Sent</span>
                    <span className="text-muted-foreground/70 text-xs ml-auto">
                      Resend in {otpCooldown}s
                    </span>
                  </div>
                )}

                <AnimatePresence>
                  {otpSent && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4"
                    >
                      <div className="block text-sm text-muted-foreground mb-2">Enter OTP</div>
                      <div className="flex gap-2 justify-center">
                        {otpCode.map((digit, i) => (
                          <input
                            key={i}
                            ref={(el) => {
                              otpRefs.current[i] = el
                            }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => {
                              handleOtpChange(i, e.target.value)
                            }}
                            onKeyDown={(e) => {
                              handleKeyDown(i, e, 'otp')
                            }}
                            onPaste={(e) => {
                              handlePaste(e, 'otp')
                            }}
                            className={cn(
                              'w-12 h-14 bg-white border rounded-md text-center text-base font-mono text-foreground outline-none transition-all',
                              loginError
                                ? 'border-red-300'
                                : 'border-border focus:border-accent focus:shadow-[0_0_0_3px_rgba(214,73,51,0.1)]',
                            )}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {loginStep === 'totp' && (
              <motion.div
                key="totp-step"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="mt-6"
              >
                <div className="block text-sm text-muted-foreground mb-1">
                  Authenticator App Code
                </div>
                <p className="text-xs text-muted-foreground/70 mb-3">
                  Open your authenticator app and enter the 6-digit code
                </p>

                <div className="flex gap-2 justify-center">
                  {totpCode.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        totpRefs.current[i] = el
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => {
                        handleTotpChange(i, e.target.value)
                      }}
                      onKeyDown={(e) => {
                        handleKeyDown(i, e, 'totp')
                      }}
                      onPaste={(e) => {
                        handlePaste(e, 'totp')
                      }}
                      className={cn(
                        'w-12 h-14 bg-white border rounded-md text-center text-base font-mono text-foreground outline-none transition-all',
                        loginError
                          ? 'border-red-300'
                          : 'border-border focus:border-accent focus:shadow-[0_0_0_3px_rgba(214,73,51,0.1)]',
                      )}
                    />
                  ))}
                </div>

                {isLoading && (
                  <div className="flex justify-center mt-4">
                    <Loader2 className="w-5 h-5 text-accent animate-spin" />
                  </div>
                )}

                <div className="flex items-center justify-center gap-3 mt-4">
                  <div className="relative w-10 h-10">
                    <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
                      <circle cx="20" cy="20" r="17" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                      <circle
                        cx="20"
                        cy="20"
                        r="17"
                        fill="none"
                        stroke={totpTimer < 5 ? '#dc2626' : totpTimer < 10 ? '#d97706' : '#d64933'}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={String(2 * Math.PI * 17)}
                        strokeDashoffset={String(2 * Math.PI * 17 * (1 - totpTimer / 30))}
                        className="transition-all duration-1000"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-sm font-mono text-foreground">
                      {totpTimer}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground/70">TOTP Window</p>
                    <p className="text-xs text-muted-foreground/70">
                      A new code generates every 30 seconds
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-6 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground/70 text-center mb-3">Staff Sign In</p>
            <div className="space-y-2">
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setLoginError(null)
                }}
                placeholder="Email"
                className="w-full bg-white border border-border rounded-md px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-accent focus:shadow-[0_0_0_2px_rgba(214,73,51,0.15)]"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setLoginError(null)
                }}
                placeholder="Password"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void handleEmailLogin()
                  }
                }}
                className="w-full bg-white border border-border rounded-md px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-accent focus:shadow-[0_0_0_2px_rgba(214,73,51,0.15)]"
              />
              <button
                onClick={() => {
                  void handleEmailLogin()
                }}
                disabled={isLoading}
                className="w-full bg-accent text-white py-2 rounded-md text-sm font-medium hover:brightness-110 active:brightness-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border flex items-start gap-2 justify-center">
            <Lock className="w-4 h-4 text-muted-foreground/70 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground/70 text-center">
              All access is logged and monitored. Unauthorized access is a criminal offense under RA
              10173.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export { LoginPage }

function BantayogLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="30" stroke="#d64933" strokeWidth="2.5" />
      <path d="M32 12L32 32" stroke="#d64933" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 32L20 44" stroke="#d64933" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 32L44 44" stroke="#d64933" strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="32" r="5" fill="#d64933" />
      <path d="M16 20L22 24" stroke="#d64933" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <path d="M48 20L42 24" stroke="#d64933" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <path d="M32 8L32 6" stroke="#d64933" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
    </svg>
  )
}

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ShieldCheck, Copy, CheckCircle, LogIn, Save } from 'lucide-react'
import { onAuthStateChanged } from 'firebase/auth'
import { motion } from 'framer-motion'
import { useReducedMotion } from '../hooks/useReducedMotion.js'
import { useSlotMachine } from '../hooks/useSlotMachine.js'
import { useMunicipalityContact } from '../hooks/useMunicipalityContact.js'
import { auth, hasFirebaseConfig } from '../services/firebase.js'
import { StatusBanner } from './ui/StatusBanner'
import { Button } from './ui/Button'
import { FallbackCards } from './ui/FallbackCards'
import { Timeline } from './ui/Timeline'

function buildVariants(mdrrmoLabel: string) {
  return {
    success: {
      headline: 'We heard you. We are here.',
      subline: `Your report is with ${mdrrmoLabel}. Keep your line open.`,
      sublineTl: 'Narinig namin kayo. Hawak na ng MDRRMO ang inyong ulat.',
      bannerVariant: 'success' as const,
      receiverText: `Received by ${mdrrmoLabel}`,
      primaryButton: 'Track this report',
      primaryVariant: 'primary' as const,
      secondaryButton: undefined as string | undefined,
      permissionText: "You can close this app. We'll text you.",
    },
    queued: {
      headline: "Saved. We'll send it for you.",
      subline: `Your report is safe on this phone. The moment signal returns, we'll automatically forward it to ${mdrrmoLabel} — no action needed from you. Walang mawawala.`,
      sublineTl: undefined as string | undefined,
      bannerVariant: 'queued' as const,
      receiverText: 'Saved to device · auto-send when online',
      primaryButton: 'Try sending now',
      primaryVariant: 'amber' as const,
      secondaryButton: 'Keep draft & close',
      permissionText: "We'll keep trying quietly in the background.",
    },
    failed_retryable: {
      headline: 'Your report is safe. Still trying.',
      subline:
        "We saved it securely on your phone and are retrying automatically. The network is having trouble — this is not your fault and nothing is lost. If it's a life-threatening emergency, call now.",
      sublineTl: 'Ligtas ang inyong ulat. Nagre-retry kami. Kung emergency, tawagan kami ngayon.',
      bannerVariant: 'queued' as const,
      receiverText: undefined as string | undefined,
      primaryButton: 'Retry now',
      primaryVariant: 'amber' as const,
      secondaryButton: 'Keep draft & close',
      permissionText: "We'll hold this draft for 24 hours and keep retrying.",
    },
    failed_terminal: {
      headline: "We couldn't send. Please call now.",
      subline: `Your draft is saved on this phone, but we have stopped retrying after several attempts. If this is an emergency, call ${mdrrmoLabel} right now — it is faster than the app right now.`,
      sublineTl:
        'Hindi naipasa ang ulat. Kung emergency, tumawag agad sa hotline o magpadala ng SMS.',
      bannerVariant: 'danger' as const,
      receiverText: undefined as string | undefined,
      primaryButton: 'Call hotline now',
      primaryVariant: 'amber' as const,
      secondaryButton: 'Keep draft & close',
      permissionText: 'We will keep your draft on this device for 24 hours.',
    },
  }
}

const GUARDIAN_BENEFITS = [
  'Track reports across devices',
  'Earn Guardian badges',
  'Get status updates via app',
]

function RadarRings({ rgb = '5,150,105' }: { rgb?: string }) {
  const ringsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (ringsRef.current) ringsRef.current.style.display = 'none'
    }, 6000)
    return () => {
      clearTimeout(timer)
    }
  }, [])
  return (
    <div
      ref={ringsRef}
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      {[0, 0.5, 1.0].map((delay, i) => (
        <motion.div
          key={i}
          className="absolute w-14 h-14 rounded-full border-2"
          style={{ borderColor: `rgba(${rgb},${String(0.6 - i * 0.2)})` }}
          animate={{ scale: [1, 2.5], opacity: [0.7, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  )
}

interface RevealSheetProps {
  state: 'success' | 'queued' | 'failed_retryable' | 'failed_terminal'
  referenceCode: string
  secretCode?: string
  municipalityId?: string
  onClose?: () => void
  onPrimaryAction?: () => void
}

export function RevealSheet({
  state,
  referenceCode,
  secretCode,
  municipalityId,
  onClose,
  onPrimaryAction,
}: RevealSheetProps) {
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()
  const contact = useMunicipalityContact(municipalityId)
  const variants = useMemo(() => buildVariants(contact.label), [contact.label])
  const { display: slotDisplay, done: slotDone } = useSlotMachine(
    referenceCode,
    reducedMotion ? 0 : 600,
    reducedMotion ? 0 : 400,
  )
  const displayedCode = reducedMotion ? referenceCode : slotDisplay
  const typewriterComplete = reducedMotion ? true : slotDone
  const [copied, setCopied] = useState(false)
  const [hasCopyError, setHasCopyError] = useState(false)
  const [secretVisible, setSecretVisible] = useState(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // null = loading (firebase present), true = guest (no account), false = registered
  const [isGuest, setIsGuest] = useState<boolean | null>(() => (hasFirebaseConfig() ? null : true))
  const variant = variants[state]

  const guardianIcon = useMemo(() => {
    if (state === 'success') return <Check size={16} />
    if (state === 'queued') return <Save size={16} />
    return <ShieldCheck size={16} />
  }, [state])

  useEffect(() => {
    if (!('vibrate' in navigator)) return
    try {
      if (state === 'success') navigator.vibrate([15, 80, 25])
      else if (state === 'queued') navigator.vibrate([30])
      else navigator.vibrate([30, 60, 30])
    } catch {
      // vibrate not available
    }
  }, [state])

  useEffect(() => {
    if (!typewriterComplete || !secretCode) return
    const t = setTimeout(
      () => {
        setSecretVisible(true)
      },
      reducedMotion ? 0 : 300,
    )
    return () => {
      clearTimeout(t)
    }
  }, [typewriterComplete, secretCode, reducedMotion])

  useEffect(() => {
    if (!hasFirebaseConfig()) return
    return onAuthStateChanged(auth(), (u) => {
      setIsGuest(u === null || u.isAnonymous)
    })
  }, [])

  const handleCopySecret = useCallback(async () => {
    if (!secretCode) return
    try {
      await navigator.clipboard.writeText(secretCode)
      setCopied(true)
      setHasCopyError(false)
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch {
      setCopied(false)
      setHasCopyError(true)
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => {
        setHasCopyError(false)
      }, 3000)
    }
  }, [secretCode])

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    }
  }, [])

  const afterglowTime = new Date().toLocaleTimeString('en-PH', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const handleTrackReport = () => {
    void navigate('/')
  }

  const handleCallHotline = () => {
    // tel: links require digits only
    const telDigits = contact.hotline.replace(/[^\d+]/g, '')
    if (!telDigits || !/\d/.test(telDigits)) {
      console.warn('[RevealSheet] Invalid hotline number:', contact.hotline)
      return
    }
    window.location.href = `tel:${telDigits}`
  }

  const handleSmsFallback = () => {
    const normalizedHotline = contact.hotline.replace(/[^\d+]/g, '')
    if (!normalizedHotline || !/\d/.test(normalizedHotline)) {
      console.warn('[RevealSheet] Invalid hotline number:', contact.hotline)
      return
    }
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const sep = isIOS ? '&' : '?'
    window.location.href = `sms:${normalizedHotline}${sep}body=${encodeURIComponent(`BANTAYOG ${referenceCode}\n[Add incident details]`)}`
  }

  const handlePrimaryAction = () => {
    if (onPrimaryAction) {
      onPrimaryAction()
      return
    }
    if (state === 'success') {
      handleTrackReport()
    } else if (state === 'failed_terminal') {
      handleCallHotline()
    } else {
      onClose?.()
    }
  }

  const nowLabel = afterglowTime
  const timelineEvents = {
    success: [
      { label: 'Report received', meta: nowLabel, state: 'complete' as const },
      { label: 'First review', meta: 'Expected within 15 min', state: 'pending' as const },
      {
        label: 'Responder dispatched',
        meta: "We'll text and update here",
        state: 'pending' as const,
      },
    ],
    queued: [
      { label: 'Saved on this phone', meta: nowLabel, state: 'queued' as const },
      {
        label: 'Send when online',
        meta: 'Automatic · no action needed',
        state: 'pending' as const,
      },
      {
        label: 'Received by MDRRMO',
        meta: "We'll text you the reference",
        state: 'pending' as const,
      },
    ],
    failed_retryable: [
      { label: 'Report drafted', meta: nowLabel, state: 'complete' as const },
      {
        label: 'Send attempt failed',
        meta: 'Network error · you can retry',
        state: 'failed' as const,
      },
      { label: 'Retry send', meta: 'Try again or call the hotline', state: 'pending' as const },
    ],
    failed_terminal: [
      { label: 'Report drafted', meta: nowLabel, state: 'complete' as const },
      {
        label: 'Sending stopped',
        meta: 'Multiple attempts failed',
        state: 'failed' as const,
      },
      {
        label: 'Call the hotline',
        meta: 'Faster than retrying the app',
        state: 'pending' as const,
      },
    ],
  }

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div
        className="absolute inset-0 bg-surface-900/60 pointer-events-auto"
        role="button"
        aria-label="Close"
        tabIndex={0}
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClose?.()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            onClose?.()
          }
        }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 max-h-[90svh] overflow-y-auto bg-surface-50 rounded-t-3xl p-5 pointer-events-auto shadow-2xl"
        style={{
          animation: 'reveal-slide-up 0.28s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        }}
      >
        <div className="w-10 h-1 bg-surface-400 rounded-full mx-auto mt-3 mb-4" />

        {!reducedMotion && (
          <div className="relative flex items-center justify-center h-20 mb-3">
            <RadarRings
              rgb={
                state === 'success'
                  ? '5,150,105'
                  : state === 'failed_terminal'
                    ? '220,38,38'
                    : '217,119,6'
              }
            />
            <div
              className={`relative z-10 w-14 h-14 rounded-full flex items-center justify-center ${
                state === 'success'
                  ? 'bg-success-500 shadow-glow-success'
                  : state === 'failed_terminal'
                    ? 'bg-danger-600 shadow-md'
                    : 'bg-warning-500 shadow-md'
              }`}
            >
              {state === 'success' ? (
                <motion.svg
                  width="28"
                  height="28"
                  viewBox="0 0 48 48"
                  fill="none"
                  className="text-white"
                >
                  <motion.circle
                    cx="24"
                    cy="24"
                    r="22"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{
                      duration: 0.4,
                      ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
                    }}
                  />
                  <motion.path
                    d="M14 24 L21 31 L34 17"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{
                      duration: 0.3,
                      delay: 0.3,
                      ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
                    }}
                  />
                </motion.svg>
              ) : state === 'queued' ? (
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                >
                  <Save size={24} className="text-white" />
                </motion.div>
              ) : (
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                >
                  <ShieldCheck size={24} className="text-white" />
                </motion.div>
              )}
            </div>
          </div>
        )}

        <StatusBanner variant={variant.bannerVariant} icon={guardianIcon}>
          {variant.headline}
        </StatusBanner>

        <p className="reveal-subheadline">
          {variant.subline}
          {variant.sublineTl ? (
            <span className="tl-hint" style={{ display: 'block', marginTop: '0.25rem' }}>
              {variant.sublineTl}
            </span>
          ) : null}
        </p>

        <div
          className={`reveal-ref-box${state === 'queued' ? ' reveal-ref-box--queued' : state === 'failed_retryable' ? ' reveal-ref-box--failed' : ''}`}
        >
          <div className="reveal-ref-label">
            {state === 'queued' ? 'Draft reference' : 'Reference'}
          </div>
          <div className="reveal-ref-code">{displayedCode}</div>
          <div className="reveal-ref-note">
            {state === 'success'
              ? `Submitted ${new Date().toLocaleTimeString()}`
              : state === 'queued'
                ? 'Will become final on send'
                : 'Nothing is lost'}
          </div>
        </div>

        {variant.receiverText ? (
          <div className="reveal-receiver">
            <div
              className={`reveal-receiver-dot reveal-receiver-dot--${state === 'queued' ? 'queued' : 'success'}`}
            />
            <span className="reveal-receiver-text">{variant.receiverText}</span>
          </div>
        ) : null}

        <Timeline events={timelineEvents[state]} />

        {state === 'success' && typewriterComplete && (
          <div className="text-center text-xs text-surface-600 mt-2">
            Sent at {afterglowTime} · {contact.label} is on it
          </div>
        )}

        {secretCode && state === 'success' && typewriterComplete && (
          <div
            className="my-3 border-t border-danger-900/10 pt-3"
            style={{
              opacity: secretVisible ? 1 : 0,
              transition: reducedMotion ? 'none' : 'opacity 300ms ease-in',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-warning-700">
                Secret Code
              </span>
              <span
                className="text-[10px] font-bold bg-surface-900 text-white px-1.5 py-0.5 rounded"
                style={{ letterSpacing: '0.04em' }}
              >
                SHOWN ONCE
              </span>
            </div>
            <div className="flex gap-2 items-center">
              <code className="flex-1 px-3 py-2 bg-white rounded-md text-sm font-mono tracking-wider">
                {secretCode}
              </code>
              <button
                type="button"
                onClick={() => {
                  void handleCopySecret()
                }}
                className="p-2 border-0 bg-brand-500 rounded-lg cursor-pointer flex items-center"
                aria-label="Copy secret code"
              >
                <Copy size={16} className="text-white" />
              </button>
            </div>
            {copied && <p className="mt-1 text-xs text-success-600">Copied!</p>}
            {hasCopyError && (
              <p className="mt-1 text-xs text-danger-600">Copy failed — please write it down</p>
            )}
            <p className="mt-2 text-xs text-surface-500">
              Save this to check your report without an account.
              <span className="block italic">
                I-save ito para macheck ang ulat nang walang account.
              </span>
            </p>
          </div>
        )}

        {state !== 'success' ? (
          <FallbackCards
            hotlineNumber={contact.hotline}
            emphasized={state === 'failed_retryable'}
            onCallClick={handleCallHotline}
            onSmsClick={handleSmsFallback}
          />
        ) : (
          <FallbackCards
            hotlineNumber={contact.hotline}
            onCallClick={handleCallHotline}
            onSmsClick={handleSmsFallback}
          />
        )}

        <Button
          variant={variant.primaryVariant}
          fullWidth
          onClick={handlePrimaryAction}
          className="mt-4"
        >
          {variant.primaryButton}
        </Button>

        {variant.secondaryButton ? (
          <div className="reveal-secondary-btn">
            <Button variant="secondary" fullWidth onClick={onClose}>
              {variant.secondaryButton}
            </Button>
          </div>
        ) : null}

        {state === 'success' && isGuest && (
          <div className="mt-4 mb-2 rounded-xl overflow-hidden bg-gradient-to-br from-brand-500 to-brand-600 p-4">
            <p className="text-white font-bold text-base mb-1">
              Maging Guardian. Samahan mo kaming magbantay.
            </p>
            <p className="text-brand-100 text-xs mb-3">
              Create a free account to track your reports, earn badges, and help protect your
              community.
            </p>
            <ul className="space-y-1 mb-3">
              {GUARDIAN_BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-center gap-2 text-white text-xs">
                  <CheckCircle size={12} className="text-brand-200 shrink-0" />
                  {benefit}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                void navigate('/register')
              }}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-white text-brand-600 font-semibold text-sm border-none cursor-pointer active:bg-brand-50 transition-colors"
            >
              <LogIn size={14} />
              Create Account
            </button>
          </div>
        )}

        <p className="reveal-footer">{variant.permissionText}</p>
      </div>
    </div>
  )
}

import { useState, useCallback } from 'react'
import { motion, AnimatePresence, useMotionValue } from 'framer-motion'
import { EyeOff, Shield, Scale, AlertTriangle, Send, ShieldCheck, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useUIStore } from '../lib/store.js'

const EASE_SMOOTH: [number, number, number, number] = [0.4, 0, 0.2, 1]
const EASE_ANTICIPATE: [number, number, number, number] = [0.34, 1.56, 0.64, 1]

/* ── Step 0: Welcome ── */
function StepWelcome() {
  return (
    <div className="flex flex-col items-center px-6 pt-8 pb-4">
      <motion.div
        className="w-full max-w-[280px] h-[200px] flex items-center justify-center"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE_ANTICIPATE }}
      >
        <img
          src="/watchtower.svg"
          alt="Watchtower illustration"
          className="w-full h-full object-contain"
        />
      </motion.div>

      <motion.h2
        className="text-[28px] font-bold text-surface-900 text-center mt-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: EASE_SMOOTH }}
      >
        Welcome to Bantayog
      </motion.h2>
      <motion.p
        className="text-[18px] font-semibold text-surface-500 text-center mt-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15, ease: EASE_SMOOTH }}
      >
        Your community watchtower
      </motion.p>
      <motion.p
        className="text-base text-surface-700 text-center mt-6 max-w-[320px]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2, ease: EASE_SMOOTH }}
      >
        Report emergencies in Camarines Norte quickly and safely. Your reports help responders reach
        those in need faster.
      </motion.p>
      <motion.div
        className="mt-8 px-4 py-2 rounded-full bg-brand-500/10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25, ease: EASE_SMOOTH }}
      >
        <span className="text-xs font-medium text-brand-500">Bayanihan sa Panahon ng Sakuna</span>
      </motion.div>
    </div>
  )
}

/* ── Step 1: Privacy ── */
const PRIVACY_CARDS = [
  {
    Icon: EyeOff,
    title: 'Report without an account',
    body: 'No registration needed. Start reporting immediately with a temporary ID.',
    color: '#0F9488',
  },
  {
    Icon: Shield,
    title: 'Your data is protected',
    body: 'Photos have location data removed. Contact info is only visible to emergency staff.',
    color: '#059669',
  },
  {
    Icon: Scale,
    title: 'Transparency first',
    body: 'We cannot guarantee complete anonymity under court orders. This is stated honestly.',
    color: '#D97706',
  },
]

function StepPrivacy({
  onConsentChange,
  consentError,
}: {
  onConsentChange: (v: boolean) => void
  consentError: boolean
}) {
  const [checked, setChecked] = useState(false)

  const toggle = useCallback(() => {
    const next = !checked
    setChecked(next)
    onConsentChange(next)
  }, [checked, onConsentChange])

  return (
    <div className="flex flex-col px-6 pt-8 pb-4">
      <motion.h2
        className="text-[28px] font-bold text-surface-900 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE_SMOOTH }}
      >
        Your privacy matters
      </motion.h2>

      <div className="mt-8 space-y-4">
        {PRIVACY_CARDS.map(({ Icon, title, body, color }, i) => (
          <motion.div
            key={title}
            className="bg-white rounded-lg p-4 shadow-md"
            style={{ borderLeft: `3px solid ${color}` }}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: i * 0.1, ease: EASE_SMOOTH }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: `${color}15` }}
              >
                <Icon size={20} style={{ color }} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-surface-900">{title}</h3>
                <p className="text-xs text-surface-500 mt-1 leading-relaxed">{body}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        className="mt-8"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4, ease: EASE_SMOOTH }}
      >
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            aria-label="I agree to the Terms of Use and Privacy Notice"
            checked={checked}
            onChange={toggle}
            className="sr-only"
          />
          <div
            className={`relative w-6 h-6 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors duration-200 ${
              checked
                ? 'bg-brand-500 border-brand-500'
                : consentError
                  ? 'border-danger-500'
                  : 'border-surface-200'
            }`}
          >
            <motion.svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <motion.path
                d="M2.5 7.5L5.5 10.5L11.5 3.5"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: checked ? 1 : 0 }}
                transition={{ duration: 0.2, ease: EASE_SMOOTH }}
              />
            </motion.svg>
          </div>
          <span className="text-base text-surface-900 leading-relaxed">
            I have read and agree to the{' '}
            <span className="text-brand-500 font-medium">Terms of Use</span> and{' '}
            <span className="text-brand-500 font-medium">Privacy Notice</span>
          </span>
        </label>
        {consentError && (
          <p className="text-xs text-danger-500 mt-2 ml-9">Please agree to continue</p>
        )}
      </motion.div>
    </div>
  )
}

/* ── Step 2: How It Works ── */
const HOW_STEPS = [
  {
    Icon: AlertTriangle,
    title: 'Report what you see',
    body: 'Choose the incident type, add a photo, and share your location.',
  },
  {
    Icon: Send,
    title: 'Send instantly',
    body: 'Your report goes directly to your municipal emergency office.',
  },
  {
    Icon: ShieldCheck,
    title: 'Help arrives',
    body: 'Track your report as responders are dispatched to the scene.',
  },
]

function StepHowItWorks() {
  return (
    <div className="flex flex-col px-6 pt-8 pb-4">
      <motion.h2
        className="text-[28px] font-bold text-surface-900 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE_SMOOTH }}
      >
        Three steps to help your community
      </motion.h2>

      <div className="mt-10 relative">
        {HOW_STEPS.map(({ Icon, title, body }, i) => (
          <motion.div
            key={title}
            className="flex items-start gap-4 mb-8"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: i * 0.15, ease: EASE_SMOOTH }}
          >
            <motion.div
              className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center flex-shrink-0 shadow-md"
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.4, delay: i * 0.15 + 0.1, ease: EASE_ANTICIPATE }}
            >
              <Icon size={22} className="text-white" />
            </motion.div>
            <div className="pt-1">
              <h3 className="text-base font-semibold text-surface-900">{title}</h3>
              <p className="text-xs text-surface-500 mt-1 leading-relaxed">{body}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

/* ── Main ── */
const BUTTON_LABELS = ['Get Started', 'Continue', 'Start Reporting']

export function Onboarding() {
  const navigate = useNavigate()
  const setHasCompletedOnboarding = useUIStore((s) => s.setHasCompletedOnboarding)
  const [step, setStep] = useState(0)
  const [consent, setConsent] = useState(false)
  const [consentError, setConsentError] = useState(false)
  const [direction, setDirection] = useState(1)
  const dragX = useMotionValue(0)

  const goNext = useCallback(() => {
    if (step === 1 && !consent) {
      setConsentError(true)
      return
    }
    setConsentError(false)
    if (step < 2) {
      setDirection(1)
      setStep((s) => s + 1)
    } else {
      setHasCompletedOnboarding(true)
      void navigate('/', { replace: true })
    }
  }, [step, consent, setHasCompletedOnboarding, navigate])

  const goPrev = useCallback(() => {
    if (step > 0) {
      setDirection(-1)
      setStep((s) => s - 1)
    }
  }, [step])

  const skip = useCallback(() => {
    setHasCompletedOnboarding(true)
    void navigate('/', { replace: true })
  }, [setHasCompletedOnboarding, navigate])

  const handleDragEnd = useCallback(
    (_: unknown, info: { offset: { x: number } }) => {
      if (info.offset.x < -50 && step < 2) goNext()
      else if (info.offset.x > 50 && step > 0) goPrev()
    },
    [step, goNext, goPrev],
  )

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0 }),
  }

  return (
    <div className="min-h-[100dvh] bg-surface-100 flex flex-col relative overflow-hidden">
      {/* Skip (step 0 only) */}
      {step === 0 && (
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={skip}
            className="px-3 py-2 text-sm font-medium text-brand-500 rounded-lg"
          >
            Skip
          </button>
        </div>
      )}

      {/* Swipeable content */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <motion.div
          className="flex-1 flex flex-col"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          style={{ x: dragX }}
        >
          <AnimatePresence custom={direction} mode="wait">
            <motion.div
              key={step}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: EASE_SMOOTH }}
              className="flex-1 flex flex-col"
            >
              {step === 0 && <StepWelcome />}
              {step === 1 && (
                <StepPrivacy
                  onConsentChange={(v) => {
                    setConsent(v)
                    if (v) setConsentError(false)
                  }}
                  consentError={consentError}
                />
              )}
              {step === 2 && <StepHowItWorks />}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Bottom: dots + button */}
      <div
        className="px-6 pb-8 pt-4 bg-gradient-to-t from-surface-100 via-surface-100 to-transparent relative z-10"
        style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom, 0px))' }}
      >
        {/* Pagination dots */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="rounded-full"
              style={{ backgroundColor: i === step ? '#0F9488' : '#D5DEDD' }}
              animate={{ width: i === step ? 24 : 8, height: 8 }}
              transition={{ duration: 0.2 }}
            />
          ))}
        </div>

        <motion.button
          type="button"
          onClick={goNext}
          className="w-full rounded-xl font-semibold text-base text-white flex items-center justify-center gap-2 bg-gradient-to-br from-brand-500 to-brand-600 active:scale-[0.98] transition-transform"
          style={{ height: step === 2 ? 64 : 56 }}
          whileTap={{ scale: 0.98 }}
          aria-label={BUTTON_LABELS[step]}
        >
          {BUTTON_LABELS[step]}
          {step === 2 && <ArrowRight size={20} />}
        </motion.button>
      </div>
    </div>
  )
}

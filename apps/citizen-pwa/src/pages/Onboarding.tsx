import { useState, useCallback } from 'react'
import { motion, AnimatePresence, useMotionValue } from 'framer-motion'
import { AlertTriangle, Send, ShieldCheck, ArrowRight, TowerControl } from 'lucide-react'
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
        <div className="w-full h-full flex items-center justify-center">
          <TowerControl size={120} strokeWidth={1.2} className="text-brand-500" />
        </div>
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

/* ── Step 1: How It Works ── */
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
const BUTTON_LABELS = ['Get Started', 'Start Reporting']

export function Onboarding() {
  const navigate = useNavigate()
  const setHasCompletedOnboarding = useUIStore((s) => s.setHasCompletedOnboarding)
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const dragX = useMotionValue(0)

  const goNext = useCallback(() => {
    if (step < 1) {
      setDirection(1)
      setStep((s) => s + 1)
    } else {
      setHasCompletedOnboarding(true)
      void navigate('/', { replace: true })
    }
  }, [step, setHasCompletedOnboarding, navigate])

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
      if (info.offset.x < -50 && step < 1) goNext()
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
              {step === 1 && <StepHowItWorks />}
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
          {[0, 1].map((i) => (
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
          className={`w-full rounded-xl font-semibold text-base text-white flex items-center justify-center gap-2 bg-gradient-to-br from-brand-500 to-brand-600 active:scale-[0.98] transition-transform ${step === 1 ? 'h-16' : 'h-14'}`}
          whileTap={{ scale: 0.98 }}
          aria-label={BUTTON_LABELS[step]}
        >
          {BUTTON_LABELS[step]}
          {step === 1 && <ArrowRight size={20} />}
        </motion.button>
      </div>
    </div>
  )
}

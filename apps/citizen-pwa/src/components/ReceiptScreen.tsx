import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { KeyRound } from 'lucide-react'
import { useSlotMachine } from '../hooks/useSlotMachine.js'
import { RadarRings, AnimatedCheck } from './ui/RadarRings.js'

const SHEET_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1]
const CONTENT_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1]

function CopyButton({ secret }: { secret: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(secret)
      setCopied(true)
      setTimeout(() => {
        setCopied(false)
      }, 1500)
    } catch {
      // clipboard unavailable
    }
  }
  return (
    <button
      type="button"
      onClick={() => {
        void handleCopy()
      }}
      className="text-xs text-brand-600 font-medium hover:text-brand-700 active:text-brand-800"
      aria-label="Copy secret code"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

export function ReceiptScreen() {
  const { state } = useLocation() as {
    state: { publicRef: string; secret: string } | null
  }
  const navigate = useNavigate()
  const { display } = useSlotMachine(state?.publicRef ?? '', 600, 400)

  useEffect(() => {
    if (!state) return
    // Haptic double-pulse: resolved, not celebratory
    if ('vibrate' in navigator) navigator.vibrate([100, 50, 100])
  }, [state])

  if (!state) {
    return (
      <section className="flex items-center justify-center min-h-[100dvh]">
        <p className="text-surface-500 text-sm">No submission to display.</p>
      </section>
    )
  }

  return (
    <div className="fixed inset-0 z-emergency flex flex-col justify-end">
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-surface-950/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => void navigate('/')}
      />

      {/* Sheet */}
      <motion.div
        className="relative z-10 bg-surface-50 rounded-t-3xl shadow-2xl overflow-hidden max-h-[85vh]"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ duration: 0.4, ease: SHEET_EASE }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-surface-300" />
        </div>

        <motion.div
          className="flex flex-col items-center text-center px-6 py-8 overflow-y-auto no-scrollbar"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: CONTENT_EASE }}
        >
          {/* Icon + radar rings */}
          <div className="relative flex items-center justify-center mb-6">
            <RadarRings color="rgb(5,150,105)" autoHideMs={6000} />
            <div className="relative z-10 w-20 h-20 rounded-full bg-success-500 flex items-center justify-center shadow-glow-success">
              <AnimatedCheck />
            </div>
          </div>

          <h2 className="text-3xl font-extrabold text-surface-900 mb-2">Report Received</h2>
          <p className="text-sm text-surface-500 mb-8 max-w-xs">
            Emergency responders have been notified. Your report is now in the system.
          </p>

          {/* Tracking reference (slot machine) */}
          <div className="bg-surface-100 rounded-xl border border-surface-200 px-6 py-4 mb-4 w-full">
            <p className="text-xs text-surface-400 uppercase tracking-wider mb-1">
              Tracking Reference
            </p>
            <p className="text-3xl font-bold tracking-widest text-surface-900 font-mono">
              {display}
            </p>
          </div>

          {/* Secret code */}
          <div className="bg-brand-50 rounded-xl border border-brand-400 px-6 py-4 mb-8 w-full">
            <div className="flex items-center gap-1.5 mb-1">
              <KeyRound className="w-3.5 h-3.5 text-brand-600" />
              <p className="text-xs text-brand-700 uppercase tracking-wider font-semibold">
                Your Secret Code
              </p>
            </div>
            <p className="text-2xl font-bold tracking-widest text-surface-900 font-mono">
              {state.secret}
            </p>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-surface-400">
                Save this — you&apos;ll need it to check status
              </p>
              <CopyButton secret={state.secret} />
            </div>
          </div>

          <button
            type="button"
            onClick={() => void navigate(`/reports/${state.publicRef}`)}
            className="w-full min-h-[56px] rounded-xl bg-brand-500 text-white font-semibold text-base flex items-center justify-center mb-3 active:bg-brand-600 transition-colors"
          >
            Track My Report
          </button>
          <button
            type="button"
            onClick={() => void navigate('/')}
            className="w-full min-h-[56px] rounded-xl bg-transparent text-surface-500 font-medium text-base flex items-center justify-center"
          >
            Back to Map
          </button>
        </motion.div>
      </motion.div>
    </div>
  )
}

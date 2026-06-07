import { motion } from 'framer-motion'
import { Save, ShieldCheck } from 'lucide-react'
import { RadarRings } from './RadarRings'

type SheetState = 'success' | 'queued' | 'failed_retryable' | 'failed_terminal'

interface RevealHeaderProps {
  state: SheetState
  reducedMotion: boolean
}

export function RevealHeader({ state, reducedMotion }: RevealHeaderProps) {
  if (reducedMotion) return null

  const ringRgb =
    state === 'success' ? '5,150,105' : state === 'failed_terminal' ? '220,38,38' : '217,119,6'

  const iconBg =
    state === 'success'
      ? 'bg-success-500 shadow-glow-success'
      : state === 'failed_terminal'
        ? 'bg-danger-600 shadow-md'
        : 'bg-warning-500 shadow-md'

  return (
    <div className="relative flex items-center justify-center h-20 mb-3">
      <RadarRings rgb={ringRgb} />
      <div
        className={`relative z-10 w-14 h-14 rounded-full flex items-center justify-center ${iconBg}`}
      >
        {state === 'success' ? (
          <motion.svg width="28" height="28" viewBox="0 0 48 48" fill="none" className="text-white">
            <motion.circle
              cx="24"
              cy="24"
              r="22"
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
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
              transition={{ duration: 0.3, delay: 0.3, ease: [0.32, 0.72, 0, 1] }}
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
  )
}

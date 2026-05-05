import { motion, AnimatePresence } from 'framer-motion'
import type { ToastType } from '../hooks/useToast'
import { useReducedMotion } from '../hooks/useReducedMotion.js'

const BG_MAP: Record<ToastType, string> = {
  success: 'bg-success-600',
  error: 'bg-danger-600',
  info: 'bg-info-600',
}

const EASE_REVEAL: [number, number, number, number] = [0.16, 1, 0.3, 1]

export function Toast({
  show,
  message,
  type,
}: {
  show: boolean
  message: string
  type: ToastType
}) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          role="status"
          aria-live="polite"
          className={`fixed bottom-24 left-4 right-4 z-50 rounded-lg shadow-lg text-white text-sm font-medium text-center px-4 py-3 ${BG_MAP[type]}`}
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3, ease: EASE_REVEAL }}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

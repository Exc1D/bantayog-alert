import { motion, AnimatePresence } from 'framer-motion'
import type { ToastType } from '../hooks/useToast'

const BG_MAP: Record<ToastType, string> = {
  success: 'bg-[#10b981]',
  error: 'bg-[#dc2626]',
  info: 'bg-[#3b82f6]',
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
          transition={{ duration: 0.3, ease: EASE_REVEAL }}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

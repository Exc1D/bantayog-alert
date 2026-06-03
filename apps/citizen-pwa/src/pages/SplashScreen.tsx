import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, AlertTriangle } from 'lucide-react'
import { useUIStore } from '../lib/store.js'
import { useNavigate } from 'react-router-dom'

const STATUS_MESSAGES = ['Getting things ready for you...', 'Preparing your community feed...']

const EASE_REVEAL: [number, number, number, number] = [0.16, 1, 0.3, 1]

interface SplashScreenProps {
  onDone?: () => void
  onReportNow?: () => void
}

export function SplashScreen({ onDone, onReportNow }: SplashScreenProps) {
  const navigate = useNavigate()
  const hasCompletedOnboarding = useUIStore((s) => s.hasCompletedOnboarding)
  const [visible, setVisible] = useState(true)
  const [statusIndex, setStatusIndex] = useState(0)
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const finish = useCallback(() => {
    setVisible(false)
    if (onDone) {
      onDone()
      return
    }
    setTimeout(() => {
      void navigate(hasCompletedOnboarding ? '/' : '/onboarding', { replace: true })
    }, 100)
  }, [hasCompletedOnboarding, navigate, onDone])

  const startReport = useCallback(() => {
    if (finishTimerRef.current) clearTimeout(finishTimerRef.current)
    setVisible(false)
    if (onReportNow) {
      onReportNow()
      return
    }
    void navigate('/report')
  }, [navigate, onReportNow])

  useEffect(() => {
    const timer = setTimeout(finish, 2500)
    finishTimerRef.current = timer
    return () => {
      clearTimeout(timer)
    }
  }, [finish])

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIndex((i) => (i + 1) % STATUS_MESSAGES.length)
    }, 1100)
    return () => {
      clearInterval(interval)
    }
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-splash flex flex-col items-center justify-center"
          style={{
            background: 'radial-gradient(circle at center, #0F172A 0%, #0F9488 100%)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Radar rings + shield */}
          <div className="relative flex items-center justify-center w-[260px] h-[260px]">
            {[80, 160, 240].map((size, i) => (
              <motion.div
                key={size}
                className="absolute rounded-full border-2 border-white/20"
                style={{ width: size, height: size }}
                animate={{ scale: [0.5, 1.5], opacity: [0.5, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear', delay: i * 0.4 }}
              />
            ))}
            <motion.div
              className="relative z-10 w-16 h-16 rounded-full flex items-center justify-center bg-white/10"
              style={{
                boxShadow: '0 0 20px rgba(13,148,136,0.5), 0 0 60px rgba(13,148,136,0.2)',
              }}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2, ease: EASE_REVEAL }}
            >
              <Shield size={32} strokeWidth={1.5} className="text-white" />
            </motion.div>
          </div>

          {/* Wordmark */}
          <motion.div
            className="flex flex-col items-center mt-8"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4, ease: EASE_REVEAL }}
          >
            <h1 className="text-white text-[32px] font-extrabold tracking-[4px]">BANTAYOG</h1>
            <span className="text-white/70 text-[18px] font-normal tracking-[8px] mt-1">ALERT</span>
          </motion.div>

          {/* Status with estimated time */}
          <motion.div
            className="mt-6 h-6 flex items-center justify-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.4 }}
          >
            <AnimatePresence mode="wait">
              <motion.p
                key={statusIndex}
                className="text-white/50 text-xs text-center"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25 }}
              >
                {STATUS_MESSAGES[statusIndex]}
              </motion.p>
            </AnimatePresence>
          </motion.div>

          {/* Progress bar — 2.2s with glow */}
          <motion.div
            className="mt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.4 }}
          >
            <div
              className="w-[220px] h-[3px] rounded-full overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #0F9488, #14B8A6, #5EEAD4)',
                  boxShadow: '0 0 10px rgba(20,184,166,0.4)',
                }}
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 2.2, ease: 'linear', delay: 0.3 }}
              />
            </div>
          </motion.div>

          {/* Emergency CTA — prominent, always accessible */}
          <motion.button
            type="button"
            onClick={startReport}
            className="mt-10 min-h-[52px] rounded-full bg-white text-danger-600 px-7 text-sm font-bold shadow-lg flex items-center gap-2 active:scale-[0.96] transition-transform"
            style={{ boxShadow: '0 4px 20px rgba(255,255,255,0.2)' }}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.0, duration: 0.4, ease: EASE_REVEAL }}
            whileTap={{ scale: 0.94 }}
          >
            <AlertTriangle size={18} strokeWidth={2.5} />
            Report emergency now
          </motion.button>

          <motion.p
            className="absolute bottom-8 text-white/30 text-[11px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.5 }}
          >
            v1.0 · Camarines Norte
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

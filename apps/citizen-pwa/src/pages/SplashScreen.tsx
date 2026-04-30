import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield } from 'lucide-react'
import { useUIStore } from '../lib/store.js'
import { useNavigate } from 'react-router-dom'

const STATUS_MESSAGES = [
  'Initializing emergency services...',
  'Connecting to watchtower...',
  'Loading Camarines Norte map data...',
]

const EASE_REVEAL: [number, number, number, number] = [0.16, 1, 0.3, 1]

interface SplashScreenProps {
  onDone?: () => void
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const navigate = useNavigate()
  const hasCompletedOnboarding = useUIStore((s) => s.hasCompletedOnboarding)
  const [visible, setVisible] = useState(true)
  const [statusIndex, setStatusIndex] = useState(0)

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

  useEffect(() => {
    const timer = setTimeout(finish, 1600)
    return () => {
      clearTimeout(timer)
    }
  }, [finish])

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIndex((i) => (i + 1) % STATUS_MESSAGES.length)
    }, 800)
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
          <div className="relative flex items-center justify-center w-[300px] h-[300px]">
            {[80, 160, 240].map((size, i) => (
              <motion.div
                key={size}
                className="absolute rounded-full border-2 border-white/30"
                style={{ width: size, height: size }}
                animate={{ scale: [0.5, 1.5], opacity: [0.6, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear', delay: i * 0.4 }}
              />
            ))}
            <motion.div
              className="relative z-10 w-16 h-16 rounded-full flex items-center justify-center"
              style={{
                background: 'rgba(255,255,255,0.1)',
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
            className="flex flex-col items-center mt-6"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4, ease: EASE_REVEAL }}
          >
            <h1 className="text-white text-[32px] font-extrabold tracking-[4px]">BANTAYOG</h1>
            <span className="text-white/70 text-[18px] font-normal tracking-[8px] mt-1">ALERT</span>
          </motion.div>

          {/* Cycling status */}
          <motion.div
            className="mt-4 h-6 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.4 }}
          >
            <AnimatePresence mode="wait">
              <motion.p
                key={statusIndex}
                className="text-white/50 text-sm text-center"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.3 }}
              >
                {STATUS_MESSAGES[statusIndex]}
              </motion.p>
            </AnimatePresence>
          </motion.div>

          {/* Progress bar — 1.5s */}
          <motion.div
            className="mt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.4 }}
          >
            <div
              className="w-[200px] h-[3px] rounded-full overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.1)' }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #0F9488, #14B8A6)',
                  boxShadow: '0 0 8px #14B8A6',
                }}
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 1.5, ease: 'linear', delay: 0.2 }}
              />
            </div>
          </motion.div>

          <motion.p
            className="absolute bottom-8 text-white/30 text-[11px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.5 }}
          >
            v1.0 · Camarines Norte
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

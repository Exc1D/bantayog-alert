import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

const SHEET_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1]

export function AnimatedCheck() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-white">
      <motion.circle
        cx="24"
        cy="24"
        r="22"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: SHEET_EASE }}
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
        transition={{ duration: 0.3, delay: 0.3, ease: SHEET_EASE }}
      />
    </svg>
  )
}

interface RadarRingsProps {
  color: string
  autoHideMs?: number
  animate?: boolean
}

export function RadarRings({ color, autoHideMs, animate = true }: RadarRingsProps) {
  const ringsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!autoHideMs) return
    const timer = setTimeout(() => {
      if (ringsRef.current) ringsRef.current.style.display = 'none'
    }, autoHideMs)
    return () => {
      clearTimeout(timer)
    }
  }, [autoHideMs])

  return (
    <div ref={ringsRef} className="absolute inset-0 flex items-center justify-center">
      {([0, 0.5, 1.0] as const).map((delay, i) => (
        <motion.div
          key={i}
          className="absolute w-20 h-20 rounded-full border-2"
          style={{ borderColor: color, ...(animate ? {} : { opacity: 0.2 }) }}
          {...(animate
            ? {
                animate: { scale: [1, 2.5], opacity: [0.7, 0] },
                transition: { duration: 2, repeat: Infinity, delay, ease: 'easeOut' },
              }
            : {})}
        />
      ))}
    </div>
  )
}

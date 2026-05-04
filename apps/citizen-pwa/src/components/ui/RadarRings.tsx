import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

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
    <div
      ref={ringsRef}
      className="absolute inset-0 flex items-center justify-center"
      aria-hidden="true"
    >
      {([0, 0.5, 1.0] as const).map((delay, i) => (
        <motion.div
          key={i}
          className="absolute w-20 h-20 rounded-full border-2"
          style={{
            borderColor: color,
            transformOrigin: 'center',
            ...(animate ? {} : { opacity: 0.2 }),
          }}
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

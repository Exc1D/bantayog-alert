import { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'

export function RadarRings({ rgb = '5,150,105' }: { rgb?: string }) {
  const ringsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (ringsRef.current) ringsRef.current.style.display = 'none'
    }, 6000)
    return () => {
      clearTimeout(timer)
    }
  }, [])
  return (
    <div
      ref={ringsRef}
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      {[0, 0.5, 1.0].map((delay, i) => (
        <motion.div
          key={i}
          className="absolute w-14 h-14 rounded-full border-2"
          style={{ borderColor: `rgba(${rgb},${String(0.6 - i * 0.2)})` }}
          animate={{ scale: [1, 2.5], opacity: [0.7, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  )
}

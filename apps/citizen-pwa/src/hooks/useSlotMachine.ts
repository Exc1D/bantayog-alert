import { useState, useEffect } from 'react'

const SLOT_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function useSlotMachine(
  target: string,
  durationMs: number,
  startDelayMs: number,
): { display: string; done: boolean } {
  const [display, setDisplay] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    let frame: number
    const startTime = performance.now() + startDelayMs
    const endTime = startTime + durationMs

    const tick = (now: number) => {
      if (now < startTime) {
        setDisplay('')
        frame = requestAnimationFrame(tick)
        return
      }
      if (now >= endTime) {
        setDisplay(target)
        setDone(true)
        return
      }
      const progress = (now - startTime) / durationMs
      const settled = Math.floor(progress * target.length)
      let result = ''
      for (let i = 0; i < target.length; i++) {
        result +=
          i < settled
            ? target.charAt(i)
            : SLOT_CHARS.charAt(Math.floor(Math.random() * SLOT_CHARS.length))
      }
      setDisplay(result)
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
    }
  }, [target, durationMs, startDelayMs])

  return { display, done }
}

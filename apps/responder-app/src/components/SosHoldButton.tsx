import { useRef, useState, useEffect, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './SosHoldButton.module.css'

interface Props {
  activeDispatchId: string | null
  disabled: boolean
}

const HOLD_MS = 3000

export function SosHoldButton({ activeDispatchId, disabled }: Props) {
  const navigate = useNavigate()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [holding, setHolding] = useState(false)

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  function startHold() {
    if (disabled || !activeDispatchId) return
    setHolding(true)
    timerRef.current = setTimeout(() => {
      setHolding(false)
      void navigate(`/dispatches/${activeDispatchId}/sos`)
    }, HOLD_MS)
  }

  function cancelHold() {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setHolding(false)
  }

  function handleKey(e: KeyboardEvent<HTMLButtonElement>, kind: 'down' | 'up') {
    if (e.key !== ' ' && e.key !== 'Enter') return
    e.preventDefault()
    if (kind === 'down') startHold()
    else cancelHold()
  }

  return (
    <button
      className={styles.btn}
      disabled={disabled}
      onPointerDown={startHold}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onKeyDown={(e) => {
        handleKey(e, 'down')
      }}
      onKeyUp={(e) => {
        handleKey(e, 'up')
      }}
      onBlur={cancelHold}
      aria-label="SOS — hold 3 seconds to activate"
      title={disabled ? 'No active dispatch' : 'Hold 3 seconds to trigger SOS'}
    >
      <span
        className={[styles.ring, holding && styles.ringActive].filter(Boolean).join(' ')}
        aria-hidden="true"
      />
      SOS
    </button>
  )
}

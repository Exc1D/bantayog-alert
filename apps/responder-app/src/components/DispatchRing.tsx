import type { ReactNode } from 'react'
import { getRingStrokeOffset } from '../lib/dispatch-progress'
import styles from './DispatchRing.module.css'

interface Props {
  mode: 'countdown' | 'progress'
  percent: number
  tone: 'accent' | 'urgent' | 'success'
  ariaLabel: string
  urgent?: boolean
  children: ReactNode
}

export function DispatchRing({ mode, percent, tone, ariaLabel, urgent = false, children }: Props) {
  const radius = 118
  const strokeDashoffset = getRingStrokeOffset(percent, radius)

  return (
    <div
      className={[styles.ring, styles[tone], mode === 'countdown' && styles.countdown]
        .filter(Boolean)
        .join(' ')}
      role={urgent ? 'alert' : 'img'}
      aria-label={ariaLabel}
    >
      <svg className={styles.svg} viewBox="0 0 280 280" aria-hidden="true">
        <circle className={styles.track} cx="140" cy="140" r={radius} />
        <circle
          className={styles.fill}
          cx="140"
          cy="140"
          r={radius}
          strokeDasharray={2 * Math.PI * radius}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <div className={styles.content}>{children}</div>
    </div>
  )
}

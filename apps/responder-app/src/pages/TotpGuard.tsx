import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from '@bantayog/shared-ui'

import styles from './TotpGuard.module.css'

interface TotpGuardProps {
  children: ReactNode
}

export function TotpGuard({ children }: TotpGuardProps) {
  const { user, claims, loading: authLoading } = useAuth()

  if (authLoading) {
    return <div className={styles.loading}>Loading…</div>
  }

  if (!user) {
    return <>{children}</>
  }

  if (import.meta.env.VITE_USE_EMULATOR === 'true') {
    return <>{children}</>
  }

  if (claims?.mfaEnrolled !== true) {
    return <Navigate to="/totp-enroll" replace />
  }

  return <>{children}</>
}

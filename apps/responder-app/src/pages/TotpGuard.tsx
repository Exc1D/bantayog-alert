import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from '@bantayog/shared-ui'

import styles from './TotpGuard.module.css'

interface TotpGuardProps {
  children: ReactNode
}

export function TotpGuard({ children }: TotpGuardProps) {
  const { user, claims, loading: authLoading } = useAuth()

  // Wait for auth to initialize
  if (authLoading) {
    return <div className={styles.loading}>Loading…</div>
  }

  // No user = allow through (public route)
  if (!user) {
    return <>{children}</>
  }

  // Check TOTP enrollment via custom claim
  if (claims?.mfaEnrolled !== true) {
    return <Navigate to="/totp-enroll" replace />
  }

  return <>{children}</>
}

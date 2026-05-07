import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { multiFactor } from 'firebase/auth'

import { useAuth } from '@bantayog/shared-ui'

import styles from './TotpGuard.module.css'

interface TotpGuardProps {
  children: ReactNode
}

export function TotpGuard({ children }: TotpGuardProps) {
  const { user, loading: authLoading } = useAuth()

  // Wait for auth to initialize
  if (authLoading) {
    return <div className={styles.loading}>Loading…</div>
  }

  // No user = allow through (public route)
  if (!user) {
    return <>{children}</>
  }

  // Check TOTP enrollment
  const enrolledFactors = multiFactor(user).enrolledFactors
  if (enrolledFactors.length === 0) {
    return <Navigate to="/totp-enroll" replace />
  }

  return <>{children}</>
}

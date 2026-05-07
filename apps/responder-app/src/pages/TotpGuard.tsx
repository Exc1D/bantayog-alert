import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { multiFactor } from 'firebase/auth'

import { auth } from '../app/firebase'

interface TotpGuardProps {
  children: ReactNode
}

export function TotpGuard({ children }: TotpGuardProps) {
  const user = auth.currentUser

  if (!user) {
    return <>{children}</>
  }

  const enrolledFactors = multiFactor(user).enrolledFactors

  if (enrolledFactors.length === 0) {
    return <Navigate to="/totp-enroll" replace />
  }

  return <>{children}</>
}

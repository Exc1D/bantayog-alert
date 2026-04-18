import { type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './auth-provider'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, claims, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div>Loading…</div>
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />

  if (claims?.role !== 'municipal_admin' && claims?.role !== 'provincial_superadmin') {
    return (
      <div role="alert">
        You don't have admin access on this account. Contact your municipality's superadmin.
      </div>
    )
  }
  if (claims?.active !== true) {
    return <div role="alert">Your account is not active. Please contact your superadmin.</div>
  }
  if (claims.role === 'municipal_admin' && !claims.municipalityId) {
    return (
      <div role="alert">
        Your admin account is missing a municipality assignment. Contact superadmin.
      </div>
    )
  }

  return <>{children}</>
}
import { type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './auth-provider.js'

interface ProtectedRouteProps {
  children: ReactNode
  allowedRoles: string[]
  requireActive?: boolean
  requireMunicipalityIdForRoles?: string[]
  loadingFallback?: ReactNode
  unauthorizedFallback?: ReactNode
}

export function ProtectedRoute({
  children,
  allowedRoles,
  requireActive = false,
  requireMunicipalityIdForRoles = [],
  loadingFallback = <div>Loading…</div>,
  unauthorizedFallback = <div role="alert">Access denied.</div>,
}: ProtectedRouteProps) {
  const { user, claims, loading } = useAuth()
  const location = useLocation()

  if (loading) return loadingFallback
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />

  const role = typeof claims?.role === 'string' ? claims.role : ''
  if (!allowedRoles.includes(role)) {
    return unauthorizedFallback
  }

  if (requireActive && claims?.active !== true) {
    return unauthorizedFallback
  }

  if (
    requireMunicipalityIdForRoles.includes(role) &&
    (typeof claims?.municipalityId !== 'string' || !claims.municipalityId)
  ) {
    return unauthorizedFallback
  }

  return <>{children}</>
}

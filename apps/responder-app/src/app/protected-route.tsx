import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './auth-provider'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, claims } = useAuth()
  const location = useLocation()
  if (loading) return <p>Loading…</p>
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (claims?.role !== 'responder') return <p>Access denied: responder role required.</p>
  return <>{children}</>
}

import { useAuth } from '@bantayog/shared-ui'
import { ScopedAnalyticsDashboard } from '../components/ScopedAnalyticsDashboard'

export function AnalyticsDashboardPage() {
  const { claims } = useAuth()
  const role = typeof claims?.role === 'string' ? claims.role : ''
  const municipalityId =
    typeof claims?.municipalityId === 'string' ? claims.municipalityId.trim() : ''
  const agencyId = typeof claims?.agencyId === 'string' ? claims.agencyId.trim() : ''

  if (role === 'municipal_admin') {
    if (!municipalityId) {
      return <div role="alert">Access denied. Missing municipality scope.</div>
    }
    return (
      <ScopedAnalyticsDashboard
        scopeField="municipalityId"
        scopeId={municipalityId}
        scopeLabel={municipalityId}
      />
    )
  }

  if (role === 'agency_admin') {
    if (!agencyId) {
      return <div role="alert">Access denied. Missing agency scope.</div>
    }
    return (
      <ScopedAnalyticsDashboard scopeField="agencyId" scopeId={agencyId} scopeLabel={agencyId} />
    )
  }

  if (role === 'provincial_superadmin') {
    return <ScopedAnalyticsDashboard scopeId="province" scopeLabel="Province" />
  }

  return <div role="alert">Access denied. Insufficient permissions for analytics.</div>
}

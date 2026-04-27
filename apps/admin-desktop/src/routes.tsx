import { Navigate, Outlet } from 'react-router-dom'
import { createBrowserRouter } from 'react-router-dom'
import { ProtectedRoute } from '@bantayog/shared-ui'
import { Sidebar } from './components/Sidebar'
import { LoginPage } from './pages/LoginPage'
import { TotpEnrollmentPage } from './pages/TotpEnrollmentPage'
import { TriageQueuePage } from './pages/TriageQueuePage'
import { AgencyAssistanceQueuePage } from './pages/AgencyAssistanceQueuePage'
import { AnalyticsDashboardPage } from './pages/AnalyticsDashboardPage'
import { RosterPage } from './pages/RosterPage'
import { ProvinceDashboardPage } from './pages/ProvinceDashboardPage'
import { ProvinceMapPage } from './pages/ProvinceMapPage'
import { UserManagementPage } from './pages/UserManagementPage'
import { ProvincialResourcesPage } from './pages/ProvincialResourcesPage'
import { SystemHealthPage } from './pages/SystemHealthPage'
import { BreakGlassPage } from './pages/BreakGlassPage'

/** Shell that renders the sidebar alongside the current route. */
function AppLayout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  )
}

const UNAUTHORIZED = (
  <div role="alert">You do not have access to this page. Please contact your superadmin.</div>
)

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  // Unprotected — TOTP enrollment must be accessible before MFA is fully set up
  { path: '/totp-enroll', element: <TotpEnrollmentPage /> },
  {
    // Layout shell wraps all authenticated routes
    element: <AppLayout />,
    children: [
      {
        path: '/',
        element: (
          <ProtectedRoute
            allowedRoles={['municipal_admin', 'provincial_superadmin']}
            requireActive
            requireMunicipalityIdForRoles={['municipal_admin']}
            unauthorizedFallback={UNAUTHORIZED}
          >
            <TriageQueuePage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/agency',
        element: (
          <ProtectedRoute
            allowedRoles={['agency_admin']}
            requireActive
            unauthorizedFallback={UNAUTHORIZED}
          >
            <AgencyAssistanceQueuePage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/analytics',
        element: (
          <ProtectedRoute
            allowedRoles={['municipal_admin', 'provincial_superadmin']}
            requireActive
            requireMunicipalityIdForRoles={['municipal_admin']}
            unauthorizedFallback={UNAUTHORIZED}
          >
            <AnalyticsDashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/roster',
        element: (
          <ProtectedRoute
            allowedRoles={['agency_admin']}
            requireActive
            unauthorizedFallback={UNAUTHORIZED}
          >
            <RosterPage />
          </ProtectedRoute>
        ),
      },
      // Province routes — provincial_superadmin only
      {
        path: '/province',
        element: (
          <ProtectedRoute
            allowedRoles={['provincial_superadmin']}
            requireActive
            unauthorizedFallback={UNAUTHORIZED}
          >
            <Outlet />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <Navigate to="/province/dashboard" replace /> },
          { path: 'dashboard', element: <ProvinceDashboardPage /> },
          { path: 'map', element: <ProvinceMapPage /> },
          { path: 'users', element: <UserManagementPage /> },
          { path: 'resources', element: <ProvincialResourcesPage /> },
          { path: 'system-health', element: <SystemHealthPage /> },
          { path: 'break-glass', element: <BreakGlassPage /> },
        ],
      },
    ],
  },
])

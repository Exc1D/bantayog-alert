import { Navigate, Outlet } from 'react-router-dom'
import { createBrowserRouter } from 'react-router-dom'
import { ProtectedRoute, useAuth } from '@bantayog/shared-ui'
import { Sidebar } from './components/Sidebar'
import { ShellKeyboardShortcuts } from './components/ShellKeyboardShortcuts'
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
import { ProvinceNdrrmcPage } from './pages/ProvinceNdrrmcPage'
import { ProvinceEmergencyPage } from './pages/ProvinceEmergencyPage'
import ScopedOperationsMapPage from './pages/ScopedOperationsMapPage'

import DashboardPage from './pages/DashboardPage'
import UsersPage from './pages/UsersPage'
import EmergencyPage from './pages/EmergencyPage'
import NdrrmcPage from './pages/NdrrmcPage'
import ReportsPage from './pages/ReportsPage'
import AuditPage from './pages/AuditPage'
import HealthPage from './pages/HealthPage'
import SmsPage from './pages/SmsPage'
import HandoffPage from './pages/HandoffPage'
import ErasurePage from './pages/ErasurePage'
import SettingsPage from './pages/SettingsPage'

function AppLayout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <ShellKeyboardShortcuts />
      <Sidebar />
      <main style={{ flex: 1, overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  )
}

function LegacyPrototypeRoute({
  fallback,
  superadminTarget,
}: {
  fallback: React.ReactNode
  superadminTarget: string
}) {
  const { claims, loading } = useAuth()
  const role = typeof claims?.role === 'string' ? claims.role : ''

  if (loading) {
    return <div>Loading…</div>
  }

  if (role === 'provincial_superadmin') {
    return <Navigate to={superadminTarget} replace />
  }

  return <>{fallback}</>
}

const UNAUTHORIZED = (
  <div role="alert">You do not have access to this page. Please contact your superadmin.</div>
)

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/totp-enroll', element: <TotpEnrollmentPage /> },

  // Prototype pages — each renders its own AppShell with Header/Sidebar
  {
    path: '/dashboard',
    element: (
      <LegacyPrototypeRoute superadminTarget="/province/dashboard" fallback={<DashboardPage />} />
    ),
  },
  {
    path: '/map',
    element: (
      <LegacyPrototypeRoute
        superadminTarget="/province/map"
        fallback={<ScopedOperationsMapPage />}
      />
    ),
  },
  {
    path: '/users',
    element: <LegacyPrototypeRoute superadminTarget="/province/users" fallback={<UsersPage />} />,
  },
  {
    path: '/emergency',
    element: (
      <LegacyPrototypeRoute superadminTarget="/province/dashboard" fallback={<EmergencyPage />} />
    ),
  },
  {
    path: '/ndrrmc',
    element: (
      <LegacyPrototypeRoute superadminTarget="/province/dashboard" fallback={<NdrrmcPage />} />
    ),
  },
  {
    path: '/reports',
    element: <LegacyPrototypeRoute superadminTarget="/analytics" fallback={<ReportsPage />} />,
  },
  {
    path: '/audit',
    element: (
      <LegacyPrototypeRoute superadminTarget="/province/dashboard" fallback={<AuditPage />} />
    ),
  },
  {
    path: '/health',
    element: (
      <LegacyPrototypeRoute superadminTarget="/province/system-health" fallback={<HealthPage />} />
    ),
  },
  { path: '/sms', element: <SmsPage /> },
  {
    path: '/handoff',
    element: (
      <LegacyPrototypeRoute superadminTarget="/province/dashboard" fallback={<HandoffPage />} />
    ),
  },
  {
    path: '/erasure',
    element: <LegacyPrototypeRoute superadminTarget="/province/users" fallback={<ErasurePage />} />,
  },
  {
    path: '/settings',
    element: (
      <LegacyPrototypeRoute superadminTarget="/province/dashboard" fallback={<SettingsPage />} />
    ),
  },

  // Legacy pages — use AppLayout with shared Sidebar
  {
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
            allowedRoles={['agency_admin', 'municipal_admin', 'provincial_superadmin']}
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
          { path: 'ndrrmc', element: <ProvinceNdrrmcPage /> },
          { path: 'emergency', element: <ProvinceEmergencyPage /> },
        ],
      },
    ],
  },

  { path: '*', element: <Navigate to="/dashboard" replace /> },
])

import { createBrowserRouter } from 'react-router-dom'
import { ProtectedRoute } from '@bantayog/shared-ui'
import { LoginPage } from './pages/LoginPage'
import { TriageQueuePage } from './pages/TriageQueuePage'
import { AgencyAssistanceQueuePage } from './pages/AgencyAssistanceQueuePage'
import { AnalyticsDashboardPage } from './pages/AnalyticsDashboardPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute
        allowedRoles={['municipal_admin', 'provincial_superadmin']}
        requireActive
        requireMunicipalityIdForRoles={['municipal_admin']}
        unauthorizedFallback={
          <div role="alert">
            You do not have access to this page. Please contact your superadmin.
          </div>
        }
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
        unauthorizedFallback={
          <div role="alert">
            You do not have access to this page. Please contact your superadmin.
          </div>
        }
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
        unauthorizedFallback={<div role="alert">You do not have access to this page.</div>}
      >
        <AnalyticsDashboardPage />
      </ProtectedRoute>
    ),
  },
])

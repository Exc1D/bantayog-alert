import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { CitizenShell } from './components/CitizenShell.js'
import { MapTab } from './components/MapTab/index.js'
import { FeedTab } from './components/FeedTab.js'
import { IncidentDetailPage } from './components/IncidentDetailPage.js'
import { ProfileTab } from './components/ProfileTab.js'
import { AlertsTab } from './components/AlertsTab.js'
import { SubmitReportForm } from './components/SubmitReportForm/index.js'
import { ReceiptScreen } from './components/ReceiptScreen.js'
import { LookupScreen } from './components/LookupScreen.js'
import { TrackingScreen } from './components/TrackingScreen.js'
import { GoodbyeScreen } from './components/GoodbyeScreen.js'
import { RegisterPage } from './pages/RegisterPage.js'
import { SettingsPage } from './pages/SettingsPage.js'

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <CitizenShell>
        <MapTab />
      </CitizenShell>
    ),
  },
  {
    path: '/report',
    element: <SubmitReportForm />,
    handle: { hideBottomNav: true },
  },
  {
    path: '/reports/:reference',
    element: <TrackingScreen />,
    handle: { hideBottomNav: true },
  },
  {
    path: '/feed',
    element: (
      <CitizenShell>
        <FeedTab />
      </CitizenShell>
    ),
  },
  {
    path: '/incidents/:id',
    element: <IncidentDetailPage />,
    handle: { hideBottomNav: true },
  },
  {
    path: '/alerts',
    element: (
      <CitizenShell>
        <AlertsTab />
      </CitizenShell>
    ),
  },
  {
    path: '/profile',
    element: (
      <CitizenShell>
        <ProfileTab />
      </CitizenShell>
    ),
  },
  { path: '/receipt', element: <ReceiptScreen /> },
  { path: '/lookup', element: <LookupScreen /> },
  { path: '/goodbye', element: <GoodbyeScreen />, handle: { hideBottomNav: true } },
  { path: '/register', element: <RegisterPage />, handle: { hideBottomNav: true } },
  { path: '/settings', element: <SettingsPage />, handle: { hideBottomNav: true } },
])

export function AppRoutes() {
  return <RouterProvider router={router} />
}

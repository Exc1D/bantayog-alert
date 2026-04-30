import { createBrowserRouter, RouterProvider, Outlet, useNavigate } from 'react-router-dom'
import { useState, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
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
import { SplashScreen } from './pages/SplashScreen.js'
import { Onboarding } from './pages/Onboarding.js'
import { useUIStore } from './lib/store.js'

function RootLayout() {
  const [showSplash, setShowSplash] = useState(true)
  const navigate = useNavigate()
  const hasCompletedOnboarding = useUIStore((s) => s.hasCompletedOnboarding)

  const onSplashDone = useCallback(() => {
    setShowSplash(false)
    if (!hasCompletedOnboarding) {
      void navigate('/onboarding', { replace: true })
    }
  }, [hasCompletedOnboarding, navigate])

  return (
    <>
      <AnimatePresence>{showSplash && <SplashScreen onDone={onSplashDone} />}</AnimatePresence>
      <Outlet />
    </>
  )
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: (
          <CitizenShell>
            <MapTab />
          </CitizenShell>
        ),
      },
      { path: 'onboarding', element: <Onboarding /> },
      {
        path: 'report',
        element: <SubmitReportForm />,
        handle: { hideBottomNav: true },
      },
      {
        path: 'reports/:reference',
        element: <TrackingScreen />,
        handle: { hideBottomNav: true },
      },
      {
        path: 'feed',
        element: (
          <CitizenShell>
            <FeedTab />
          </CitizenShell>
        ),
      },
      {
        path: 'incidents/:id',
        element: <IncidentDetailPage />,
        handle: { hideBottomNav: true },
      },
      {
        path: 'alerts',
        element: (
          <CitizenShell>
            <AlertsTab />
          </CitizenShell>
        ),
      },
      {
        path: 'profile',
        element: (
          <CitizenShell>
            <ProfileTab />
          </CitizenShell>
        ),
      },
      { path: 'receipt', element: <ReceiptScreen /> },
      { path: 'lookup', element: <LookupScreen /> },
      { path: 'goodbye', element: <GoodbyeScreen />, handle: { hideBottomNav: true } },
      { path: 'register', element: <RegisterPage />, handle: { hideBottomNav: true } },
      { path: 'settings', element: <SettingsPage />, handle: { hideBottomNav: true } },
    ],
  },
])

export function AppRoutes() {
  return <RouterProvider router={router} />
}

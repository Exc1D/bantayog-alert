import { createBrowserRouter, RouterProvider, Outlet, useNavigate } from 'react-router-dom'
import { useState, useCallback, lazy, Suspense } from 'react'
import { AnimatePresence } from 'framer-motion'
import { CitizenShell } from './components/CitizenShell.js'
import { MapTab } from './components/MapTab/index.js'
import { SplashScreen } from './pages/SplashScreen.js'
import { useUIStore } from './lib/store.js'

/* ── Lazy-loaded route components ── */
const Onboarding = lazy(() =>
  import('./pages/Onboarding.js').then((m) => ({ default: m.Onboarding })),
)
const FeedTab = lazy(() => import('./components/FeedTab.js').then((m) => ({ default: m.FeedTab })))
const IncidentDetailPage = lazy(() =>
  import('./components/IncidentDetailPage.js').then((m) => ({ default: m.IncidentDetailPage })),
)
const ProfileTab = lazy(() =>
  import('./components/ProfileTab.js').then((m) => ({ default: m.ProfileTab })),
)
const AlertsTab = lazy(() =>
  import('./components/AlertsTab.js').then((m) => ({ default: m.AlertsTab })),
)
const SubmitReportForm = lazy(() =>
  import('./components/SubmitReportForm/index.js').then((m) => ({ default: m.SubmitReportForm })),
)
const ReceiptScreen = lazy(() =>
  import('./components/ReceiptScreen.js').then((m) => ({ default: m.ReceiptScreen })),
)
const LookupScreen = lazy(() =>
  import('./components/LookupScreen.js').then((m) => ({ default: m.LookupScreen })),
)
const TrackingScreen = lazy(() =>
  import('./components/TrackingScreen.js').then((m) => ({ default: m.TrackingScreen })),
)
const GoodbyeScreen = lazy(() =>
  import('./components/GoodbyeScreen.js').then((m) => ({ default: m.GoodbyeScreen })),
)
const RegisterPage = lazy(() =>
  import('./pages/RegisterPage.js').then((m) => ({ default: m.RegisterPage })),
)
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage.js').then((m) => ({ default: m.SettingsPage })),
)

function RouteFallback() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-surface-100">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

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
      {
        path: 'onboarding',
        element: (
          <Suspense fallback={<RouteFallback />}>
            <Onboarding />
          </Suspense>
        ),
      },
      {
        path: 'report',
        element: (
          <Suspense fallback={<RouteFallback />}>
            <SubmitReportForm />
          </Suspense>
        ),
        handle: { hideBottomNav: true },
      },
      {
        path: 'reports/:reference',
        element: (
          <Suspense fallback={<RouteFallback />}>
            <TrackingScreen />
          </Suspense>
        ),
        handle: { hideBottomNav: true },
      },
      {
        path: 'feed',
        element: (
          <CitizenShell>
            <Suspense fallback={<RouteFallback />}>
              <FeedTab />
            </Suspense>
          </CitizenShell>
        ),
      },
      {
        path: 'incidents/:id',
        element: (
          <Suspense fallback={<RouteFallback />}>
            <IncidentDetailPage />
          </Suspense>
        ),
        handle: { hideBottomNav: true },
      },
      {
        path: 'alerts',
        element: (
          <CitizenShell>
            <Suspense fallback={<RouteFallback />}>
              <AlertsTab />
            </Suspense>
          </CitizenShell>
        ),
      },
      {
        path: 'profile',
        element: (
          <CitizenShell>
            <Suspense fallback={<RouteFallback />}>
              <ProfileTab />
            </Suspense>
          </CitizenShell>
        ),
      },
      {
        path: 'receipt',
        element: (
          <Suspense fallback={<RouteFallback />}>
            <ReceiptScreen />
          </Suspense>
        ),
      },
      {
        path: 'lookup',
        element: (
          <Suspense fallback={<RouteFallback />}>
            <LookupScreen />
          </Suspense>
        ),
      },
      {
        path: 'goodbye',
        element: (
          <Suspense fallback={<RouteFallback />}>
            <GoodbyeScreen />
          </Suspense>
        ),
        handle: { hideBottomNav: true },
      },
      {
        path: 'register',
        element: (
          <Suspense fallback={<RouteFallback />}>
            <RegisterPage />
          </Suspense>
        ),
        handle: { hideBottomNav: true },
      },
      {
        path: 'settings',
        element: (
          <Suspense fallback={<RouteFallback />}>
            <SettingsPage />
          </Suspense>
        ),
        handle: { hideBottomNav: true },
      },
    ],
  },
])

export function AppRoutes() {
  return <RouterProvider router={router} />
}

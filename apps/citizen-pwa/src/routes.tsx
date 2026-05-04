import {
  createBrowserRouter,
  RouterProvider,
  Outlet,
  useNavigate,
  useLocation,
} from 'react-router-dom'
import { useState, useCallback, lazy, Suspense, type ComponentType } from 'react'
import { AnimatePresence } from 'framer-motion'
import { CitizenShell } from './components/CitizenShell.js'
import { MapTab } from './components/MapTab/index.js'
import { SplashScreen } from './pages/SplashScreen.js'
import { useUIStore } from './lib/store.js'
import { ErrorBoundary } from './components/ErrorBoundary.js'
import { useResumeRegistration } from './hooks/useResumeRegistration.js'

/* ── Retry helper for lazy-loaded chunks ── */
function lazyWithRetry(
  factory: () => Promise<{ default: ComponentType<unknown> }>,
  retries = 3,
  delay = 500,
) {
  return lazy(() => {
    const attempt = (n: number): Promise<{ default: ComponentType<unknown> }> =>
      factory().catch((err: unknown) => {
        if (n <= 0) throw err
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(attempt(n - 1))
          }, delay)
        })
      })
    return attempt(retries)
  })
}

/* ── Lazy-loaded route components ── */
const Onboarding = lazyWithRetry(() =>
  import('./pages/Onboarding.js').then((m) => ({ default: m.Onboarding })),
)
const FeedTab = lazyWithRetry(() =>
  import('./components/FeedTab.js').then((m) => ({ default: m.FeedTab })),
)
const IncidentDetailPage = lazyWithRetry(() =>
  import('./components/IncidentDetailPage.js').then((m) => ({ default: m.IncidentDetailPage })),
)
const ProfileTab = lazyWithRetry(() =>
  import('./components/ProfileTab.js').then((m) => ({ default: m.ProfileTab })),
)
const AlertsTab = lazyWithRetry(() =>
  import('./components/AlertsTab.js').then((m) => ({ default: m.AlertsTab })),
)
const SubmitReportForm = lazyWithRetry(() =>
  import('./components/SubmitReportForm/index.js').then((m) => ({ default: m.SubmitReportForm })),
)
const ReceiptScreen = lazyWithRetry(() =>
  import('./components/ReceiptScreen.js').then((m) => ({ default: m.ReceiptScreen })),
)
const LookupScreen = lazyWithRetry(() =>
  import('./components/LookupScreen.js').then((m) => ({ default: m.LookupScreen })),
)
const TrackingScreen = lazyWithRetry(() =>
  import('./components/TrackingScreen.js').then((m) => ({ default: m.TrackingScreen })),
)
const GoodbyeScreen = lazyWithRetry(() =>
  import('./components/GoodbyeScreen.js').then((m) => ({ default: m.GoodbyeScreen })),
)
const RegisterPage = lazyWithRetry(() =>
  import('./pages/RegisterPage.js').then((m) => ({ default: m.RegisterPage })),
)
const SettingsPage = lazyWithRetry(() =>
  import('./pages/SettingsPage.js').then((m) => ({ default: m.SettingsPage })),
)
const NotFoundPage = lazyWithRetry(() =>
  import('./pages/NotFoundPage.js').then((m) => ({ default: m.NotFoundPage })),
)
const LoginPage = lazyWithRetry(() =>
  import('./pages/LoginPage.js').then((m) => ({ default: m.LoginPage })),
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
  const { pathname } = useLocation()
  const hasCompletedOnboarding = useUIStore((s) => s.hasCompletedOnboarding)
  useResumeRegistration()

  const onSplashDone = useCallback(() => {
    setShowSplash(false)
    const isAuthPage = pathname === '/login' || pathname === '/register'
    if (!hasCompletedOnboarding && !isAuthPage) {
      void navigate('/onboarding', { replace: true })
    }
  }, [hasCompletedOnboarding, navigate, pathname])

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
        path: 'login',
        element: (
          <Suspense fallback={<RouteFallback />}>
            <LoginPage />
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
      {
        path: '*',
        element: (
          <Suspense fallback={<RouteFallback />}>
            <NotFoundPage />
          </Suspense>
        ),
      },
    ],
  },
])

export function AppRoutes() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  )
}

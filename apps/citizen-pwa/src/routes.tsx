import { createBrowserRouter, RouterProvider, useNavigate } from 'react-router-dom'
import { CitizenShell } from './components/CitizenShell.js'
import { MapTab } from './components/MapTab/index.js'
import { SubmitReportForm } from './components/SubmitReportForm/index.js'
import { ReceiptScreen } from './components/ReceiptScreen.js'
import { LookupScreen } from './components/LookupScreen.js'
import { TrackingScreen } from './components/TrackingScreen.js'
import { GoodbyeScreen } from './components/GoodbyeScreen.js'
import { DeleteAccountFlow } from './components/DeleteAccountFlow.js'

function StubTab({ label }: { label: string }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100%' }}>
      <p>{label} — coming soon</p>
    </div>
  )
}

function ProfileTab() {
  const navigate = useNavigate()
  return (
    <div style={{ padding: '1.5rem' }}>
      <h2>Profile</h2>
      <section style={{ marginTop: '2rem', borderTop: '1px solid #eee', paddingTop: '1.5rem' }}>
        <h3>Privacy</h3>
        <DeleteAccountFlow onGoodbye={() => void navigate('/goodbye')} />
      </section>
    </div>
  )
}

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
        <StubTab label="Feed" />
      </CitizenShell>
    ),
  },
  {
    path: '/alerts',
    element: (
      <CitizenShell>
        <StubTab label="Alerts" />
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
])

export function AppRoutes() {
  return <RouterProvider router={router} />
}

import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { CitizenShell } from './components/CitizenShell.js'
import { MapTab } from './components/MapTab/index.js'
import { SubmitReportForm } from './components/SubmitReportForm.js'
import { ReceiptScreen } from './components/ReceiptScreen.js'
import { LookupScreen } from './components/LookupScreen.js'

function StubTab({ label }: { label: string }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100%' }}>
      <p>{label} — coming soon</p>
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
    element: (
      <CitizenShell>
        <SubmitReportForm />
      </CitizenShell>
    ),
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
        <StubTab label="Profile" />
      </CitizenShell>
    ),
  },
  { path: '/receipt', element: <ReceiptScreen /> },
  { path: '/lookup', element: <LookupScreen /> },
])

export function AppRoutes() {
  return <RouterProvider router={router} />
}

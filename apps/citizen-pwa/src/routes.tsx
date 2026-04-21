import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { SubmitReportForm } from './components/SubmitReportForm/index.js'
import { ReceiptScreen } from './components/ReceiptScreen.js'
import { LookupScreen } from './components/LookupScreen.js'
import { TrackingScreen } from './components/TrackingScreen.js'

const router = createBrowserRouter([
  { path: '/', element: <SubmitReportForm /> },
  { path: '/receipt', element: <ReceiptScreen /> },
  { path: '/lookup', element: <LookupScreen /> },
  {
    path: '/report/new',
    element: <SubmitReportForm />,
    handle: { hideBottomNav: true },
  },
  {
    path: '/reports/:reference',
    element: <TrackingScreen />,
    handle: { hideBottomNav: true },
  },
])

export function AppRoutes() {
  return <RouterProvider router={router} />
}

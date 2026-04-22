import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { SubmitReportForm } from './components/SubmitReportForm/index.js'
import { TrackingScreen } from './components/TrackingScreen.js'

const router = createBrowserRouter([
  { path: '/', element: <SubmitReportForm /> },
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

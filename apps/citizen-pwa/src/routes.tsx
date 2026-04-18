import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { SubmitReportForm } from './components/SubmitReportForm.js'
import { ReceiptScreen } from './components/ReceiptScreen.js'
import { LookupScreen } from './components/LookupScreen.js'

const router = createBrowserRouter([
  { path: '/', element: <SubmitReportForm /> },
  { path: '/receipt', element: <ReceiptScreen /> },
  { path: '/lookup', element: <LookupScreen /> },
])

export function AppRoutes() {
  return <RouterProvider router={router} />
}

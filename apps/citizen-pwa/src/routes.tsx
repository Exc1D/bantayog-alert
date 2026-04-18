import { createBrowserRouter, RouterProvider } from 'react-router-dom'

function SubmitReportForm() {
  return <div>SubmitReportForm — coming in Task 20</div>
}
function ReceiptScreen() {
  return <div>ReceiptScreen — coming in Task 21</div>
}
function LookupScreen() {
  return <div>LookupScreen — coming in Task 21</div>
}

const router = createBrowserRouter([
  { path: '/', element: <SubmitReportForm /> },
  { path: '/receipt', element: <ReceiptScreen /> },
  { path: '/lookup', element: <LookupScreen /> },
])

export function AppRoutes() {
  return <RouterProvider router={router} />
}

import { Navigate } from 'react-router-dom'
import { createBrowserRouter } from 'react-router-dom'

export const router = createBrowserRouter([{ path: '*', element: <Navigate to="/" replace /> }])

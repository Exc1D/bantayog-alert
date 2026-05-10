import { createBrowserRouter, Navigate } from 'react-router-dom'
import DashboardPage from './pages/DashboardPage'
import MapPage from './pages/MapPage'
import MobileGate from './pages/MobileGate'

const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

export const router = createBrowserRouter([
  { path: '/', element: isMobile ? <MobileGate /> : <Navigate to="/dashboard" replace /> },
  { path: '/dashboard', element: <DashboardPage /> },
  { path: '/map', element: <MapPage /> },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
])

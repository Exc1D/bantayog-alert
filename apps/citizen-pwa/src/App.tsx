import { useRevealGuard } from './lib/routerGuard'
import { AppRoutes } from './routes.js'

export function App() {
  useRevealGuard()
  return <AppRoutes />
}

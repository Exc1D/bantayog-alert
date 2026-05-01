import { Home } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-surface-100 px-4 text-center">
      <h1 className="text-6xl font-bold text-surface-300 mb-4">404</h1>
      <h2 className="text-xl font-bold text-surface-900 mb-2">Page not found</h2>
      <p className="text-sm text-surface-600 mb-6 max-w-md">
        The page you are looking for does not exist or has been moved.
      </p>
      <button
        type="button"
        onClick={() => void navigate('/')}
        className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 transition-colors"
      >
        <Home size={18} />
        Go to Home
      </button>
    </div>
  )
}

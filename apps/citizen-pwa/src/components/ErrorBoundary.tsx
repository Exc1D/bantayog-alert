import type { ReactNode } from 'react'
import { Component, type ErrorInfo } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static getDerivedStateFromError(_error: Error): State {
    return { hasError: true }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-surface-100 px-4 text-center">
          <AlertTriangle size={48} className="text-error-500 mb-4" />
          <h1 className="text-xl font-bold text-surface-900 mb-2">Something went wrong</h1>
          <p className="text-sm text-surface-600 mb-6 max-w-md">
            We apologize for the inconvenience. Please try again or contact support if the problem
            persists.
          </p>
          <button
            type="button"
            onClick={() => (window.location.href = '/')}
            className="px-6 py-3 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 transition-colors"
          >
            Go to Home
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

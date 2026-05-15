import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  // Debug logging removed; Sentry or equivalent should be wired here if needed.
  // override componentDidCatch(error: Error, errorInfo: { componentStack?: string }) {
  //   console.error('[ErrorBoundary] Caught error:', error.message, '\nComponent stack:', errorInfo.componentStack)
  // }

  override render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex h-screen items-center justify-center bg-[var(--color-surface)] text-[var(--color-text-primary)]">
            <div className="text-center">
              <h2 className="text-xl font-semibold">Something went wrong</h2>
              <button
                onClick={() => {
                  window.location.reload()
                }}
                className="mt-4 rounded-md bg-[var(--color-sienna)] px-4 py-2 text-white"
              >
                Refresh
              </button>
            </div>
          </div>
        )
      )
    }
    return this.props.children
  }
}

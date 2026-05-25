import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  override componentDidCatch(
    error: Error,
    errorInfo: { componentStack?: string },
  ) {
    // Log to console in all environments; Sentry or similar can be wired here
     
    console.error('ErrorBoundary caught an error:', error, errorInfo.componentStack)
  }

  override render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex h-screen items-center justify-center bg-[var(--color-surface)] text-[var(--color-text-primary)]">
            <div className="max-w-md p-6 text-center">
              <h2 className="text-xl font-semibold">Something went wrong</h2>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                The application encountered an unexpected error. Please refresh to continue.
              </p>
              {this.state.error && (
                <details className="mt-4 text-left">
                  <summary className="cursor-pointer text-xs text-[var(--color-text-muted)]">
                    Error details
                  </summary>
                  <pre className="mt-2 max-h-32 overflow-auto rounded bg-[var(--color-surface-elevated)] p-2 text-xs text-[var(--color-text-muted)]">
                    {this.state.error.message}
                  </pre>
                </details>
              )}
              <div className="mt-6 flex items-center justify-center gap-3">
                <button
                  onClick={() => {
                    window.history.back()
                  }}
                  className="rounded-md border border-white/10 px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-white/5"
                >
                  Go Back
                </button>
                <button
                  onClick={() => {
                    window.location.reload()
                  }}
                  className="rounded-md bg-[var(--color-sienna)] px-4 py-2 text-sm text-white hover:opacity-90"
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>
        )
      )
    }
    return this.props.children
  }
}

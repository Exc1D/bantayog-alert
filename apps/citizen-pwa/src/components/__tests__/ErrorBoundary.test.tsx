import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary } from '../ErrorBoundary.js'

// Component that throws an error
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Test error')
  return <div>No error</div>
}

describe('ErrorBoundary', () => {
  // Suppress console.error for expected errors
  const originalError = console.error
  beforeAll(() => {
    console.error = vi.fn()
  })
  afterAll(() => {
    console.error = originalError
  })

  it('should render children when there is no error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>,
    )
    expect(screen.getByText('No error')).toBeInTheDocument()
  })

  it('should catch and display error when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    )
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
  })

  it('should provide a way to go back home', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    )
    const homeButton = screen.getByRole('button', { name: /go to home/i })
    expect(homeButton).toBeInTheDocument()
  })

  let originalLocation: Location | undefined

  afterEach(() => {
    if (!originalLocation) return
    // @ts-expect-error test override
    window.location = originalLocation
    originalLocation = undefined
  })

  it('should navigate to home when recovery button is clicked', () => {
    originalLocation = window.location
    // @ts-expect-error test override
    delete window.location
    window.location = Object.create(originalLocation, {
      href: { value: '', writable: true, configurable: true },
    })

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    )
    const homeButton = screen.getByRole('button', { name: /go to home/i })
    fireEvent.click(homeButton)
    expect(window.location.href).toBe('/')
  })
})

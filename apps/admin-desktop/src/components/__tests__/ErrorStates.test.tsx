import { render, screen } from '@testing-library/react'
import { ErrorState } from '../ErrorStates'

describe('ErrorStates', () => {
  it('should render error message', () => {
    render(<ErrorState message="Failed to load data" />)
    expect(screen.getByText(/failed to load data/i)).toBeInTheDocument()
  })

  it('should render retry button when onRetry provided', () => {
    const onRetry = vi.fn()
    render(<ErrorState message="Failed to load data" onRetry={onRetry} />)

    const button = screen.getByRole('button', { name: /retry/i })
    expect(button).toBeInTheDocument()

    button.click()
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('should not render retry button when onRetry not provided', () => {
    render(<ErrorState message="Failed to load data" />)

    const button = screen.queryByRole('button', { name: /retry/i })
    expect(button).not.toBeInTheDocument()
  })

  it('should render error icon', () => {
    const { container } = render(<ErrorState message="Failed to load data" />)
    const icon = container.querySelector('[data-testid="error-icon"]')
    expect(icon).toBeInTheDocument()
  })
})

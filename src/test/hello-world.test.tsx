import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { App } from '../app/App'

describe('Phase 0: Project Setup Verification', () => {
  it('should render the app without crashing', () => {
    render(<App />)
    expect(screen.getByText('Bantayog Alert')).toBeInTheDocument()
  })

  it('should display the project description', () => {
    render(<App />)
    expect(
      screen.getByText(
        'Disaster reporting and alerting platform for Camarines Norte, Philippines'
      )
    ).toBeInTheDocument()
  })

  it('should show Phase 0 completion message', () => {
    render(<App />)
    expect(
      screen.getByText(/✅ Project setup complete! Phase 0 infrastructure is ready./)
    ).toBeInTheDocument()
  })

  it('should have correct Tailwind classes applied', () => {
    const { container } = render(<App />)
    const mainDiv = container.querySelector('.min-h-screen')
    expect(mainDiv).toBeInTheDocument()
    expect(mainDiv).toHaveClass('bg-gray-50', 'flex', 'items-center', 'justify-center')
  })
})

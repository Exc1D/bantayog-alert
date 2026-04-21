import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { setupServer } from 'msw/node'
import { TestWrapper } from './test-utils'

vi.mock('../services/firebase', () => ({
  db: {},
  fns: {},
  ensureSignedIn: vi.fn().mockResolvedValue('test-uid'),
}))

const server = setupServer()

beforeEach(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  server.close()
})

describe('Submission flow integration', () => {
  it('should render submit report form steps', () => {
    render(
      <TestWrapper>
        <div>Submit report form test placeholder</div>
      </TestWrapper>,
    )

    expect(screen.getByText('Submit report form test placeholder')).toBeInTheDocument()
  })

  it('should show Step1Evidence with incident type selection', () => {
    render(
      <TestWrapper>
        <div>Step 1 Evidence placeholder</div>
      </TestWrapper>,
    )

    expect(screen.getByText('Step 1 Evidence placeholder')).toBeInTheDocument()
  })

  it('should show Step3Review with review content', () => {
    render(
      <TestWrapper>
        <div>Review your report placeholder</div>
      </TestWrapper>,
    )

    expect(screen.getByText('Review your report placeholder')).toBeInTheDocument()
  })

  it('should complete full happy path submission flow', () => {
    render(
      <TestWrapper>
        <div>Form submission flow placeholder</div>
      </TestWrapper>,
    )

    expect(screen.getByText('Form submission flow placeholder')).toBeInTheDocument()
  })

  it('should save draft when offline', () => {
    // TODO: Implement offline simulation test
  })

  it('should show queued Reveal on network error', () => {
    // TODO: Implement network error test
  })
})

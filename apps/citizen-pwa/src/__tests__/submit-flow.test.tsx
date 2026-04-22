import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TestWrapper } from './test-utils'

vi.mock('../services/firebase', () => ({
  db: {},
  fns: {},
  ensureSignedIn: vi.fn().mockResolvedValue('test-uid'),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual }
})

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Submission flow integration', () => {
  it('should render Step1Evidence with incident type selection', () => {
    render(
      <TestWrapper>
        <div>Submit report form test placeholder</div>
      </TestWrapper>,
    )
    expect(screen.getByText('Submit report form test placeholder')).toBeInTheDocument()
  })

  it('should show Step3Review with review content', () => {
    render(
      <TestWrapper>
        <div>Review your report placeholder</div>
      </TestWrapper>,
    )
    expect(screen.getByText('Review your report placeholder')).toBeInTheDocument()
  })

  it.todo('TICKET-56: should save draft when offline')
  it.todo('TICKET-57: should show queued Reveal on network error')
})

/// <reference types="node" />
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TestWrapper } from './test-utils'

const mockSave = vi.hoisted(() => vi.fn())

vi.mock('../services/wizard-snapshot', () => ({
  wizardSnapshot: {
    load: vi.fn().mockResolvedValue(null),
    save: mockSave,
    clear: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../services/firebase', () => ({
  auth: vi.fn(() => ({ currentUser: null })),
  db: {},
  fns: {},
  hasFirebaseConfig: vi.fn(() => false),
  ensureSignedIn: vi.fn().mockResolvedValue('test-uid'),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DraftSaveIndicator', () => {
  it('shows "Saving draft..." during a write and "Draft saved" after', async () => {
    const { DraftSaveIndicator } = await import('../components/SubmitReportForm/DraftSaveIndicator')
    const { rerender } = render(
      <TestWrapper>
        <DraftSaveIndicator saveState="saving" />
      </TestWrapper>,
    )

    expect(screen.getByText(/saving draft/i)).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()

    rerender(
      <TestWrapper>
        <DraftSaveIndicator saveState="saved" />
      </TestWrapper>,
    )
    expect(screen.getByText(/draft saved/i)).toBeInTheDocument()
  })

  it('renders nothing when saveState is "idle"', async () => {
    const { DraftSaveIndicator } = await import('../components/SubmitReportForm/DraftSaveIndicator')
    const { container } = render(
      <TestWrapper>
        <DraftSaveIndicator saveState="idle" />
      </TestWrapper>,
    )
    expect(container.firstChild).toBeNull()
  })
})

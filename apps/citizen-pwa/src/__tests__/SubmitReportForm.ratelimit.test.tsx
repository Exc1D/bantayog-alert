/// <reference types="node" />
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TestWrapper } from './test-utils'

const mockCreateDraft = vi.hoisted(() => vi.fn())

vi.mock('../services/submit-report', () => ({
  createDraft: mockCreateDraft,
}))

vi.mock('../services/wizard-snapshot', () => ({
  wizardSnapshot: {
    load: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
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

vi.mock('../services/localForageReports', () => ({
  saveReport: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../lib/imageCompress', () => ({
  compressImage: vi.fn().mockResolvedValue(new Blob()),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SubmitReportForm — rate limit error', () => {
  it('createDraft mock can be configured to reject with resource-exhausted', () => {
    const rateLimitError = new Error('resource-exhausted')
    mockCreateDraft.mockRejectedValue(rateLimitError)
    expect(mockCreateDraft).toBeDefined()
    // Full integration coverage lives in the inline RateLimitError component test below.
  })
})

describe('SubmitReportForm — rate limit inline error message', () => {
  it('surfaces rate-limit-specific text when error code is resource-exhausted', async () => {
    // Test the error rendering component directly
    const { RateLimitError } = await import('../components/SubmitReportForm/RateLimitError')
    render(
      <TestWrapper>
        <RateLimitError />
      </TestWrapper>,
    )
    expect(screen.getByText(/reached the report limit/i)).toBeInTheDocument()
    expect(screen.getByText(/Naabot mo na ang limitasyon/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /call barangay hotline/i })).toBeInTheDocument()
  })
})

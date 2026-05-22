import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import FeedPage from '../pages/FeedPage'

const mockVerifyReport = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ status: 'verified', reportId: 'r-awaiting' }),
)
const mockUnpublishReport = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ visibilityClass: 'internal', reportId: 'r-public' }),
)
const mockSignOut = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

vi.mock('../services/callables', () => ({
  callables: {
    verifyReport: mockVerifyReport,
    unpublishReport: mockUnpublishReport,
  },
}))

vi.mock('@bantayog/shared-ui', () => ({
  useAuth: () => ({ signOut: mockSignOut }),
}))

vi.mock('../hooks/useFirestoreListeners', () => ({
  useFirestoreListeners: () => ({
    loading: false,
    error: null,
    reports: [
      {
        id: 'r-awaiting',
        reportType: 'flood',
        severity: 'high',
        municipalityLabel: 'Daet',
        barangayId: 'Camambugan',
        submittedAt: 1713350400000,
        status: 'awaiting_verify',
        description: 'Needs swear word removed',
        publicLocation: { lat: 14.1, lng: 122.9 },
        visibilityClass: 'internal',
        updatedAt: 1713350400001,
      },
      {
        id: 'r-public',
        reportType: 'fire',
        severity: 'medium',
        municipalityLabel: 'Labo',
        barangayId: 'San Roque',
        submittedAt: 1713350500000,
        status: 'verified',
        description: 'Public feed copy',
        publicLocation: { lat: 14.2, lng: 122.8 },
        visibilityClass: 'public_alertable',
        updatedAt: 1713350500001,
      },
      {
        id: 'r-hidden',
        reportType: 'landslide',
        severity: 'low',
        municipalityLabel: 'Mercedes',
        barangayId: 'Barangay 1',
        submittedAt: 1713350600000,
        status: 'verified',
        description: 'Hidden feed copy',
        publicLocation: { lat: 14.3, lng: 122.7 },
        visibilityClass: 'internal',
        updatedAt: 1713350600001,
      },
      {
        id: 'r-new',
        reportType: 'fire',
        severity: 'low',
        municipalityLabel: 'Paracale',
        barangayId: 'Barangay 2',
        submittedAt: 1713350700000,
        status: 'new',
        description: 'New incoming report',
        publicLocation: { lat: 14.4, lng: 122.6 },
        visibilityClass: 'internal',
        updatedAt: 1713350700001,
      },
    ],
    reportOps: [],
    alerts: [],
    responders: [],
  }),
}))

describe('FeedPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders pending and public feed reports for moderation', () => {
    render(
      <MemoryRouter>
        <FeedPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Feed moderation' })).toBeInTheDocument()
    expect(screen.getByText('Needs swear word removed')).toBeInTheDocument()
    expect(screen.getByText('Public feed copy')).toBeInTheDocument()
    expect(screen.getByText('Pending publication')).toBeInTheDocument()
    expect(screen.getByText('Published')).toBeInTheDocument()

    // verified+internal items are not feed-relevant and should be hidden
    expect(screen.queryByText('Hidden feed copy')).not.toBeInTheDocument()
    expect(screen.queryByText('Unpublished')).not.toBeInTheDocument()
  })

  it('publishes scrubbed copy through verifyReport', async () => {
    render(
      <MemoryRouter>
        <FeedPage />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('Scrubbed copy for r-awaiting'), {
      target: { value: 'Needs sensitive detail removed' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Publish scrubbed copy for r-awaiting' }))

    await waitFor(() => {
      expect(mockVerifyReport).toHaveBeenCalledWith(
        expect.objectContaining({
          reportId: 'r-awaiting',
          scrubbedDescription: 'Needs sensitive detail removed',
        }),
      )
    })
  })

  it('surfaces sign-out errors in the actionError banner', async () => {
    mockSignOut.mockRejectedValueOnce(new Error('Network error during sign out'))
    render(
      <MemoryRouter>
        <FeedPage />
      </MemoryRouter>,
    )

    const signOutBtn = screen.getByRole('button', { name: /sign out/i })
    fireEvent.click(signOutBtn)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Network error during sign out/)
    })
  })

  it('unpublishes already-public feed reports through the backend callable', async () => {
    render(
      <MemoryRouter>
        <FeedPage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Unpublish report r-public' }))

    await waitFor(() => {
      expect(mockUnpublishReport).toHaveBeenCalledWith(
        expect.objectContaining({
          reportId: 'r-public',
          reason: 'sensitive_content',
        }),
      )
    })
  })

  it('shows new reports in the feed and hides verified+internal reports', () => {
    render(
      <MemoryRouter>
        <FeedPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Needs swear word removed')).toBeInTheDocument()
    expect(screen.getByText('Public feed copy')).toBeInTheDocument()
    // 'new' items MUST appear so admins can send them to moderation
    expect(screen.getByText('New incoming report')).toBeInTheDocument()
    // verified+internal items should not appear
    expect(screen.queryByText('Hidden feed copy')).not.toBeInTheDocument()
  })
})

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

vi.mock('../services/callables', () => ({
  callables: {
    verifyReport: mockVerifyReport,
    unpublishReport: mockUnpublishReport,
  },
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
    expect(screen.getByText('Unpublished')).toBeInTheDocument()
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
})

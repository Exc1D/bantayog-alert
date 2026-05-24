import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import FeedPage from '../pages/FeedPage'

const mockVerifyReport = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ status: 'verified', reportId: 'r-awaiting' }),
)
const mockUnpublishReport = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ visibilityClass: 'internal', reportId: 'r-public' }),
)
const mockSignOut = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const mockGetDocs = vi.hoisted(() => vi.fn(() => new Promise(() => undefined)))
const mockCollection = vi.hoisted(() => vi.fn())
const mockUpdateDoc = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const mockDoc = vi.hoisted(() => vi.fn())
const mockGetDownloadURL = vi.hoisted(() => vi.fn().mockResolvedValue('mock-url'))

vi.mock('../app/firebase', () => ({ db: {} }))

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc: mockDoc,
  getDocs: mockGetDocs,
  updateDoc: mockUpdateDoc,
}))

vi.mock('firebase/storage', () => ({
  getDownloadURL: mockGetDownloadURL,
  getStorage: vi.fn(() => ({})),
  ref: vi.fn(),
}))

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
        reporterName: 'Maria Private',
        reporterPhone: '0917PRIVATE',
        reporterEmail: 'maria@example.test',
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
    alerts: [
      {
        id: 'alert-1',
        hazardType: 'flood',
        message: 'Evacuate low-lying areas now.',
        affectedMunicipalityIds: ['Daet'],
        publishedAt: 1713350800000,
        declaredAt: 1713350750000,
      },
    ],
    responders: [],
  }),
}))

describe('FeedPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCollection.mockReset()
    mockGetDocs.mockImplementation(() => new Promise(() => undefined))
    mockGetDownloadURL.mockResolvedValue('mock-url')
  })

  it('renders pending and public feed reports for moderation', () => {
    render(
      <MemoryRouter>
        <FeedPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Feed moderation' })).toBeInTheDocument()
    const moderationQueue = screen.getByRole('region', { name: 'Feed moderation queue' })
    expect(within(moderationQueue).getByText('Needs swear word removed')).toBeInTheDocument()
    expect(within(moderationQueue).getByText('Public feed copy')).toBeInTheDocument()
    expect(within(moderationQueue).getByText('Pending publication')).toBeInTheDocument()
    expect(within(moderationQueue).getByText('Published')).toBeInTheDocument()

    // verified+internal items are not feed-relevant and should be hidden
    expect(within(moderationQueue).queryByText('Hidden feed copy')).not.toBeInTheDocument()
    expect(within(moderationQueue).queryByText('Unpublished')).not.toBeInTheDocument()
  })

  it('renders citizen-visible public feed cards without private reporter fields', () => {
    render(
      <MemoryRouter>
        <FeedPage />
      </MemoryRouter>,
    )

    const publicFeed = screen.getByRole('region', { name: 'Citizen-visible public feed' })
    expect(within(publicFeed).getByText('Public feed copy')).toBeInTheDocument()
    expect(within(publicFeed).getByText(/Labo \/ San Roque/)).toBeInTheDocument()
    expect(within(publicFeed).queryByText('Hidden feed copy')).not.toBeInTheDocument()
    expect(within(publicFeed).queryByText('Maria Private')).not.toBeInTheDocument()
    expect(within(publicFeed).queryByText('0917PRIVATE')).not.toBeInTheDocument()
    expect(within(publicFeed).queryByText('maria@example.test')).not.toBeInTheDocument()
  })

  it('does not fall back to all report media in the public feed preview', async () => {
    mockCollection.mockImplementation((...segments: unknown[]) => ({
      path: segments.join('/'),
    }))
    mockGetDocs.mockImplementation((collectionRef?: unknown): Promise<unknown> => {
      const path =
        typeof (collectionRef as { path?: unknown }).path === 'string'
          ? (collectionRef as { path: string }).path
          : ''
      return Promise.resolve({
        docs: path.includes('/r-public/media')
          ? [
              {
                id: 'media-public-1',
                data: () => ({ storagePath: 'reports/r-public/media-public-1.jpg' }),
              },
            ]
          : [],
      })
    })

    render(
      <MemoryRouter>
        <FeedPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(mockGetDownloadURL).toHaveBeenCalledTimes(1)
    })
    const publicFeed = screen.getByRole('region', { name: 'Citizen-visible public feed' })
    await expect(
      within(publicFeed).findByRole('img', { name: /public report media/i }, { timeout: 100 }),
    ).rejects.toThrow()
  })

  it('renders recent official alerts from the alerts listener', () => {
    render(
      <MemoryRouter>
        <FeedPage />
      </MemoryRouter>,
    )

    const alerts = screen.getByRole('region', { name: 'Recent official alerts' })
    expect(within(alerts).getByText('Evacuate low-lying areas now.')).toBeInTheDocument()
    expect(within(alerts).getByText(/flood/i)).toBeInTheDocument()
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

  it('sends new reports to moderation through verifyReport', async () => {
    render(
      <MemoryRouter>
        <FeedPage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Send report r-new to moderation' }))

    await waitFor(() => {
      expect(mockVerifyReport).toHaveBeenCalledWith(
        expect.objectContaining({
          reportId: 'r-new',
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

    const moderationQueue = screen.getByRole('region', { name: 'Feed moderation queue' })
    expect(within(moderationQueue).getByText('Needs swear word removed')).toBeInTheDocument()
    expect(within(moderationQueue).getByText('Public feed copy')).toBeInTheDocument()
    // 'new' items MUST appear so admins can send them to moderation
    expect(within(moderationQueue).getByText('New incoming report')).toBeInTheDocument()
    // verified+internal items should not appear
    expect(within(moderationQueue).queryByText('Hidden feed copy')).not.toBeInTheDocument()
  })
})

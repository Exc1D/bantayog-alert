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
const mockSetCitizenContentVisibility = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ visibility: 'internal', contentId: 'sit-1' }),
)
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
    setCitizenContentVisibility: mockSetCitizenContentVisibility,
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
        affectedMunicipalityIds: ['daet'],
        publishedAt: 1713350800000,
        declaredAt: 1713350750000,
        visibility: 'public',
      },
      {
        id: 'alert-legacy',
        hazardType: 'typhoon',
        message: 'Legacy alert without visibility should not be treated as public.',
        affectedMunicipalityIds: ['daet'],
        publishedAt: 1713350700000,
        declaredAt: 1713350650000,
      },
    ],
    situationUpdates: [
      {
        id: 'sit-1',
        authorUid: 'citizen-1',
        createdAt: 1713350900000,
        municipalityId: 'daet',
        municipalityLabel: 'Daet',
        barangayLabel: 'San Jose',
        hazardType: 'typhoon',
        condition: 'heavy_rain',
        body: 'Heavy rain near the market.',
        visibility: 'public',
        reportedCount: 2,
      },
      // Older but flagged harder than sit-1 — must sort first.
      {
        id: 'sit-flagged',
        authorUid: 'spammer-1',
        createdAt: 1713350000000,
        municipalityId: 'daet',
        municipalityLabel: 'Daet',
        hazardType: 'flood',
        condition: 'flooding',
        body: 'Flagged spam post.',
        visibility: 'public',
        reportedCount: 7,
      },
      {
        id: 'sit-spam-2',
        authorUid: 'spammer-1',
        createdAt: 1713350100000,
        municipalityId: 'daet',
        municipalityLabel: 'Daet',
        hazardType: 'flood',
        condition: 'flooding',
        body: 'Second spam post.',
        visibility: 'public',
        reportedCount: 0,
      },
      // Newest of the spammer's posts, but already hidden — hide-all must skip it.
      {
        id: 'sit-spam-hidden',
        authorUid: 'spammer-1',
        createdAt: 1713351000000,
        municipalityId: 'daet',
        municipalityLabel: 'Daet',
        hazardType: 'flood',
        condition: 'flooding',
        body: 'Already hidden spam post.',
        visibility: 'internal',
        reportedCount: 0,
      },
      ...Array.from({ length: 10 }, (_, i) => ({
        id: `sit-bulk-${String(i)}`,
        authorUid: `bulk-author-${String(i)}`,
        createdAt: 1713340000000 + i,
        municipalityId: 'daet',
        municipalityLabel: 'Daet',
        hazardType: 'other',
        condition: 'safe',
        body: `Bulk situation post ${String(i)}.`,
        visibility: 'public',
        reportedCount: 0,
      })),
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

    // Default tab is New
    const moderationQueue = screen.getByRole('region', { name: 'Feed moderation queue' })
    expect(within(moderationQueue).getByText('New incoming report')).toBeInTheDocument()
    // Pending items are on a separate tab
    expect(within(moderationQueue).queryByText('Needs swear word removed')).not.toBeInTheDocument()

    // Switch to Pending tab
    fireEvent.click(screen.getByRole('button', { name: /Pending/i }))
    expect(within(moderationQueue).getByText('Needs swear word removed')).toBeInTheDocument()
    expect(within(moderationQueue).getByText('Pending publication')).toBeInTheDocument()

    // Switch to Live tab
    fireEvent.click(screen.getByRole('button', { name: /Live/i }))
    expect(within(moderationQueue).getByText('Public feed copy')).toBeInTheDocument()
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
    expect(within(publicFeed).getByText(/Labo · San Roque/)).toBeInTheDocument()
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

  it('shows every in-scope situation post, flagged-first, with author uid', () => {
    render(
      <MemoryRouter>
        <FeedPage />
      </MemoryRouter>,
    )

    const communityFeed = screen.getByRole('region', { name: 'Citizen feed moderation' })
    // No 10-post cap: all 14 mocked updates render.
    expect(within(communityFeed).getAllByRole('article')).toHaveLength(14)
    // Most-flagged first, even though sit-1 is newer.
    const articles = within(communityFeed).getAllByRole('article')
    expect(within(articles[0]!).getByText('Flagged spam post.')).toBeInTheDocument()
    expect(within(articles[1]!).getByText('Heavy rain near the market.')).toBeInTheDocument()
    // Author uid is visible so operators can spot repeat offenders.
    expect(within(articles[0]!).getByText(/spammer-1/)).toBeInTheDocument()
  })

  it('hides all visible public posts by an author after confirmation', async () => {
    render(
      <MemoryRouter>
        <FeedPage />
      </MemoryRouter>,
    )

    // Every post by the author carries the same hide-all action — click the first.
    fireEvent.click(screen.getAllByRole('button', { name: 'Hide all posts by spammer-1' })[0]!)
    // Confirmation modal names the count of affected public posts.
    expect(screen.getByText(/2 public post/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Hide all' }))

    await waitFor(() => {
      expect(mockSetCitizenContentVisibility).toHaveBeenCalledTimes(2)
    })
    const calledIds = mockSetCitizenContentVisibility.mock.calls.map(
      (call) => (call[0] as { contentId: string }).contentId,
    )
    expect(calledIds).toContain('sit-flagged')
    expect(calledIds).toContain('sit-spam-2')
    // The already-hidden post is skipped.
    expect(calledIds).not.toContain('sit-spam-hidden')
    mockSetCitizenContentVisibility.mock.calls.forEach((call) => {
      expect(call[0]).toMatchObject({ surface: 'feed', visibility: 'internal' })
    })
  })

  it('lets admins hide citizen feed situation updates through the backend', async () => {
    render(
      <MemoryRouter>
        <FeedPage />
      </MemoryRouter>,
    )

    const communityFeed = screen.getByRole('region', { name: 'Citizen feed moderation' })
    expect(within(communityFeed).getByText('Heavy rain near the market.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Hide situation update sit-1' }))

    await waitFor(() => {
      expect(mockSetCitizenContentVisibility).toHaveBeenCalledWith(
        expect.objectContaining({
          surface: 'feed',
          contentId: 'sit-1',
          visibility: 'internal',
          reason: 'sensitive_content',
        }),
      )
    })
  })

  it('lets admins retire official alerts through the backend', async () => {
    render(
      <MemoryRouter>
        <FeedPage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Retire alert alert-1' }))

    await waitFor(() => {
      expect(mockSetCitizenContentVisibility).toHaveBeenCalledWith(
        expect.objectContaining({
          surface: 'alerts',
          contentId: 'alert-1',
          visibility: 'internal',
          reason: 'other',
        }),
      )
    })
  })

  it('treats missing alert visibility as hidden from citizens', () => {
    render(
      <MemoryRouter>
        <FeedPage />
      </MemoryRouter>,
    )

    const alerts = screen.getByRole('region', { name: 'Recent official alerts' })
    expect(
      within(alerts).getByText('Legacy alert without visibility should not be treated as public.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Restore retired alert alert-legacy' }),
    ).toBeInTheDocument()
  })

  it('publishes scrubbed copy through verifyReport', async () => {
    render(
      <MemoryRouter>
        <FeedPage />
      </MemoryRouter>,
    )

    // Switch to Pending tab to find the awaiting_verify report
    fireEvent.click(screen.getByRole('button', { name: /Pending/i }))
    fireEvent.change(screen.getByLabelText('Kopyang nilinis para sa r-awaiting'), {
      target: { value: 'Needs sensitive detail removed' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'I-publish ang kopyang nilinis para sa r-awaiting' }),
    )

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

    // Default tab is New
    fireEvent.click(screen.getByRole('button', { name: 'Send report r-new to moderation' }))

    await waitFor(() => {
      expect(mockVerifyReport).toHaveBeenCalledWith(
        expect.objectContaining({
          reportId: 'r-new',
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

    // Switch to Live tab to find the published report
    fireEvent.click(screen.getByRole('button', { name: /Live/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Unpublish report r-public' }))
    fireEvent.click(screen.getByRole('button', { name: 'Unpublish' }))

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

    // Default tab is New
    const moderationQueue = screen.getByRole('region', { name: 'Feed moderation queue' })
    expect(within(moderationQueue).getByText('New incoming report')).toBeInTheDocument()

    // Switch to Pending to see awaiting_verify items
    fireEvent.click(screen.getByRole('button', { name: /Pending/i }))
    expect(within(moderationQueue).getByText('Needs swear word removed')).toBeInTheDocument()

    // Switch to Live to see published items
    fireEvent.click(screen.getByRole('button', { name: /Live/i }))
    expect(within(moderationQueue).getByText('Public feed copy')).toBeInTheDocument()

    // verified+internal items should not appear
    expect(within(moderationQueue).queryByText('Hidden feed copy')).not.toBeInTheDocument()
  })
})

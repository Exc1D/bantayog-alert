import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'

const mockUsePublicFeed = vi.hoisted(() => vi.fn())
const mockRetry = vi.fn()

vi.mock('../hooks/usePublicFeed', () => ({
  usePublicFeed: mockUsePublicFeed,
}))

import { FeedPage } from './FeedPage'

describe('FeedPage', () => {
  beforeEach(() => {
    mockRetry.mockClear()
    mockUsePublicFeed.mockReturnValue({
      items: [],
      loading: false,
      error: null,
      retry: mockRetry,
      lastUpdatedAt: null,
    })
  })

  it('renders a loading state', () => {
    mockUsePublicFeed.mockReturnValue({
      items: [],
      loading: true,
      error: null,
      retry: mockRetry,
      lastUpdatedAt: null,
    })

    render(<FeedPage />)

    expect(screen.getByRole('status')).toHaveTextContent(/loading incident feed/i)
  })

  it('renders an empty state', () => {
    render(<FeedPage />)

    expect(screen.getByText(/no reports yet/i)).toBeInTheDocument()
  })

  it('renders an error state', () => {
    mockUsePublicFeed.mockReturnValue({
      items: [],
      loading: false,
      error: 'permission_denied',
      retry: mockRetry,
      lastUpdatedAt: null,
    })

    render(<FeedPage />)

    expect(screen.getByRole('alert')).toHaveTextContent(/could not load incident feed/i)
    expect(screen.getByRole('alert')).toHaveTextContent(/permission_denied/i)
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('calls retry when retry button is clicked', () => {
    mockUsePublicFeed.mockReturnValue({
      items: [],
      loading: false,
      error: 'network_error',
      retry: mockRetry,
      lastUpdatedAt: null,
    })

    render(<FeedPage />)

    const retryBtn = screen.getByRole('button', { name: /retry/i })
    retryBtn.click()
    expect(mockRetry).toHaveBeenCalledTimes(1)
  })

  it('keeps stale feed items visible when a refresh error occurs', () => {
    mockUsePublicFeed.mockReturnValue({
      loading: false,
      error: 'permission_denied',
      retry: mockRetry,
      lastUpdatedAt: null,
      items: [
        {
          id: 'stale-report-1',
          reportType: 'flood',
          severity: 'high',
          status: 'verified',
          barangayId: 'Barangay 1',
          municipalityLabel: 'Daet',
          description: 'Still visible from cache',
          submittedAtMillis: Date.now() - 120_000,
        },
      ],
    })

    render(<FeedPage />)

    expect(screen.getByRole('alert')).toHaveTextContent(/could not refresh feed/i)
    expect(screen.getByRole('alert')).toHaveTextContent(/permission_denied/i)
    expect(screen.getByRole('article', { name: /flood report in daet/i })).toBeInTheDocument()
    expect(screen.getByText(/still visible from cache/i)).toBeInTheDocument()
  })

  it('renders a familiar incident feed card without social actions', () => {
    mockUsePublicFeed.mockReturnValue({
      loading: false,
      error: null,
      retry: mockRetry,
      lastUpdatedAt: null,
      items: [
        {
          id: 'report-1',
          reportType: 'flood',
          severity: 'high',
          status: 'verified',
          barangayId: 'Barangay 1',
          municipalityLabel: 'Daet',
          description: 'Water rising near the public market',
          publicLocation: { lat: 14.112, lng: 122.955 },
          submittedAtMillis: Date.now() - 120_000,
          verifiedAtMillis: Date.now() - 60_000,
        },
      ],
    })

    render(<FeedPage />)

    expect(screen.getByRole('article', { name: /flood report in daet/i })).toBeInTheDocument()
    expect(screen.getByText(/water rising near the public market/i)).toBeInTheDocument()
    expect(screen.getByText(/barangay 1, daet/i)).toBeInTheDocument()
    expect(screen.getAllByText(/high/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('verified')).toBeInTheDocument()
    expect(screen.queryByText(/comment/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/share/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/reaction/i)).not.toBeInTheDocument()
  })

  it('renders featured media in a compact grid', () => {
    mockUsePublicFeed.mockReturnValue({
      loading: false,
      error: null,
      retry: mockRetry,
      lastUpdatedAt: null,
      items: [
        {
          id: 'report-with-media',
          reportType: 'fire',
          severity: 'medium',
          status: 'verified',
          barangayId: 'Barangay 2',
          municipalityLabel: 'Basud',
          description: 'Smoke visible from the road',
          submittedAtMillis: Date.now(),
          featuredMediaUrls: ['https://cdn.example/one.jpg', 'https://cdn.example/two.jpg'],
        },
      ],
    })

    render(<FeedPage />)

    expect(screen.getAllByRole('img', { name: /incident media/i })).toHaveLength(2)
  })

  it('clamps long descriptions with a Show more button', () => {
    mockUsePublicFeed.mockReturnValue({
      loading: false,
      error: null,
      retry: mockRetry,
      lastUpdatedAt: null,
      items: [
        {
          id: 'report-long',
          reportType: 'landslide',
          severity: 'medium',
          status: 'verified',
          barangayId: 'Barangay 3',
          municipalityLabel: 'Mercedes',
          description:
            'A massive landslide has blocked the main highway connecting multiple barangays. The debris field extends over two hundred meters and has caused significant damage to nearby structures. Several families have been evacuated and emergency responders are on the scene assessing the structural integrity of surrounding buildings. The area remains unstable and further landslides are possible during continued rainfall. Motorists are advised to take alternate routes and avoid the region entirely.',
          submittedAtMillis: Date.now(),
        },
      ],
    })

    render(<FeedPage />)

    expect(screen.getByText(/debris field extends/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /show full report description/i }),
    ).toBeInTheDocument()
  })

  it('renders compact rows when more than 10 items are present', () => {
    mockUsePublicFeed.mockReturnValue({
      loading: false,
      error: null,
      retry: mockRetry,
      lastUpdatedAt: null,
      items: Array.from({ length: 11 }, (_, i) => ({
        id: `report-${String(i)}`,
        reportType: 'flood',
        severity: 'high',
        status: 'verified',
        barangayId: 'Barangay 1',
        municipalityLabel: 'Daet',
        description: 'Water rising',
        submittedAtMillis: Date.now(),
      })),
    })

    render(<FeedPage />)

    const cards = screen.getAllByRole('article')
    expect(cards.length).toBe(11)
    expect(
      screen.queryByRole('button', { name: /show full report description/i }),
    ).not.toBeInTheDocument()
    expect(screen.queryByAltText(/incident media/i)).not.toBeInTheDocument()
  })
})

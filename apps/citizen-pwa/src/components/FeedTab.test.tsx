import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { FeedTab } from './FeedTab'

const {
  mockUseSituationUpdates,
  mockCreateSituationUpdate,
  mockReportSituationUpdate,
  mockHasFirebaseConfig,
  mockUseOnlineStatus,
} = vi.hoisted(() => ({
  mockUseSituationUpdates: vi.fn(),
  mockCreateSituationUpdate: vi.fn().mockResolvedValue(undefined),
  mockReportSituationUpdate: vi.fn().mockResolvedValue(undefined),
  mockHasFirebaseConfig: vi.fn().mockReturnValue(true),
  mockUseOnlineStatus: vi.fn().mockReturnValue({ isOnline: true, navigatorOnline: true }),
}))

vi.mock('../hooks/useSituationUpdates.js', () => ({
  useSituationUpdates: (...args: unknown[]) => {
    const result = mockUseSituationUpdates(...args)
    return result as { updates: unknown[]; loading: boolean; error: Error | null }
  },
}))

vi.mock('../services/situation-updates.js', () => ({
  createSituationUpdate: (...args: unknown[]) => mockCreateSituationUpdate(...args),
  reportSituationUpdate: (...args: unknown[]) => mockReportSituationUpdate(...args),
}))

vi.mock('../services/firebase.js', () => ({
  hasFirebaseConfig: () => mockHasFirebaseConfig(),
}))

vi.mock('../hooks/useOnlineStatus.js', () => ({
  useOnlineStatus: () => mockUseOnlineStatus(),
}))

function renderFeedTab() {
  return render(
    <MemoryRouter>
      <FeedTab />
    </MemoryRouter>,
  )
}

describe('FeedTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockHasFirebaseConfig.mockReturnValue(true)
    mockUseOnlineStatus.mockReturnValue({ isOnline: true, navigatorOnline: true })
    mockCreateSituationUpdate.mockResolvedValue(undefined)
    mockReportSituationUpdate.mockResolvedValue(undefined)
    mockUseSituationUpdates.mockReturnValue({
      updates: [],
      loading: false,
      error: null,
      lastUpdatedAt: null,
      retry: vi.fn(),
    })
  })

  it('renders without crashing', () => {
    const { container } = renderFeedTab()
    expect(container).toBeInTheDocument()
  })

  it('shows empty state when no situation updates', () => {
    renderFeedTab()
    expect(screen.getByText('No situation updates')).toBeInTheDocument()
  })

  it('renders filter chips without border', () => {
    renderFeedTab()
    const chips = screen.getAllByRole('button')
    const filterChips = chips.filter((chip) => chip.getAttribute('aria-pressed') !== null)
    expect(filterChips.length).toBeGreaterThan(0)
    for (const chip of filterChips) {
      expect(chip.classList.contains('border-none')).toBe(true)
    }
  })

  it('uses the selected municipality as the composer default', () => {
    renderFeedTab()
    fireEvent.click(screen.getByRole('button', { name: 'Labo' }))
    fireEvent.click(screen.getByRole('button', { name: /What's happening\? Share an update/i }))
    expect(screen.getByLabelText('Municipality')).toHaveValue('Labo')
  })

  it('keeps the composer compact until the user chooses to share', () => {
    renderFeedTab()
    expect(screen.getByRole('button', { name: /What's happening\? Share an update/i })).toBeInTheDocument()
    expect(screen.queryByLabelText('Municipality')).not.toBeInTheDocument()
  })

  it('opens the composer with neutral incident defaults', () => {
    renderFeedTab()
    fireEvent.click(screen.getByRole('button', { name: /What's happening\? Share an update/i }))
    expect(screen.getByLabelText('Municipality')).toHaveValue('')
    expect(screen.getByLabelText('Situation type')).toHaveValue('')
    expect(screen.getByLabelText('Current condition')).toHaveValue('')
    expect(screen.getByText(/community update only/i)).toBeInTheDocument()
  })

  it('explains public sharing, moderation, and missing fields before posting', () => {
    renderFeedTab()
    fireEvent.click(screen.getByRole('button', { name: /What's happening\? Share an update/i }))
    expect(screen.getByText(/shared publicly as a citizen update/i)).toBeInTheDocument()
    expect(screen.getByText(/reported posts go to admins for review/i)).toBeInTheDocument()
    expect(
      screen.getByText(
        /to post, add municipality, situation type, condition, and a 3\+ character update/i,
      ),
    ).toBeInTheDocument()
  })

  it('preserves composer input and blocks posting while offline', () => {
    mockUseOnlineStatus.mockReturnValue({ isOnline: false, navigatorOnline: false })
    renderFeedTab()
    fireEvent.click(screen.getByRole('button', { name: /What's happening\? Share an update/i }))
    fireEvent.change(screen.getByLabelText('Municipality'), { target: { value: 'Labo' } })
    fireEvent.change(screen.getByLabelText('Situation type'), { target: { value: 'flood' } })
    fireEvent.change(screen.getByLabelText('Current condition'), {
      target: { value: 'flooding' },
    })
    fireEvent.change(screen.getByLabelText('Share situation update'), {
      target: { value: 'Water is rising near the bridge.' },
    })

    expect(screen.getByText(/reconnect to post/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Post update' })).toBeDisabled()
    expect(screen.getByLabelText('Share situation update')).toHaveValue(
      'Water is rising near the bridge.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getByRole('button', { name: /What's happening\? Share an update/i }))
    expect(screen.getByLabelText('Share situation update')).toHaveValue(
      'Water is rising near the bridge.',
    )
    expect(screen.getByText(/saved on this phone until posted/i)).toBeInTheDocument()
  })

  it('explains when a selected municipality has no posts yet', () => {
    renderFeedTab()
    fireEvent.click(screen.getByRole('button', { name: 'Labo' }))
    expect(screen.getByText(/no posts for Labo yet/i)).toBeInTheDocument()
  })

  it('ignores unsupported values from a stored composer draft', () => {
    localStorage.setItem(
      'bantayog_situation_update_draft',
      JSON.stringify({
        municipalityLabel: 'Labo',
        barangayLabel: '',
        hazardType: 'not-real',
        condition: 'flooding',
        body: 'This stale draft must not hydrate.',
      }),
    )
    renderFeedTab()
    fireEvent.click(screen.getByRole('button', { name: /What's happening\? Share an update/i }))

    expect(screen.getByLabelText('Municipality')).toHaveValue('')
    expect(screen.getByLabelText('Share situation update')).toHaveValue('')
  })

  it('shows loading skeletons when loading=true', () => {
    mockUseSituationUpdates.mockReturnValue({
      updates: [],
      loading: true,
      error: null,
      lastUpdatedAt: null,
      retry: vi.fn(),
    })
    renderFeedTab()
    expect(screen.getByText('Situation Feed')).toBeInTheDocument()
    expect(screen.getByText('Loading situation updates')).toBeInTheDocument()
    expect(screen.queryByText('No situation updates')).not.toBeInTheDocument()
  })

  it('shows error state when error is set', () => {
    const retry = vi.fn()
    mockUseSituationUpdates.mockReturnValue({
      updates: [],
      loading: false,
      error: new Error('Server error'),
      lastUpdatedAt: null,
      retry,
    })
    renderFeedTab()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByText('Could not load situation updates')).toBeInTheDocument()
    expect(retry).toHaveBeenCalledOnce()
  })

  it('shows when the feed last refreshed', () => {
    vi.spyOn(Date, 'now').mockReturnValue(60_000)
    mockUseSituationUpdates.mockReturnValue({
      updates: [],
      loading: false,
      error: null,
      lastUpdatedAt: 60_000,
      retry: vi.fn(),
    })
    renderFeedTab()
    expect(screen.getByText('Updated just now')).toBeInTheDocument()
    vi.mocked(Date.now).mockRestore()
  })

  it('ages the feed freshness label while the tab stays open', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(60_000)
      mockUseSituationUpdates.mockReturnValue({
        updates: [],
        loading: false,
        error: null,
        lastUpdatedAt: 60_000,
        retry: vi.fn(),
      })
      renderFeedTab()
      expect(screen.getByText('Updated just now')).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(60_000)
      })

      expect(screen.getByText('Updated 1m ago')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('renders situation cards when data is present', () => {
    mockUseSituationUpdates.mockReturnValue({
      updates: [
        {
          id: 'sit-1',
          authorUid: 'citizen-1',
          createdAt: Date.now(),
          municipalityLabel: 'Daet',
          barangayLabel: 'San Jose',
          hazardType: 'typhoon',
          condition: 'heavy_rain',
          body: 'Strong rain and ankle-deep water near the market.',
          visibility: 'public',
          reportedCount: 0,
        },
      ],
      loading: false,
      error: null,
    })
    renderFeedTab()
    expect(screen.getByText('Typhoon update in San Jose, Daet')).toBeInTheDocument()
    expect(
      screen.getByText('Strong rain and ankle-deep water near the market.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Heavy rain')).toBeInTheDocument()
  })

  it('shows community pulse metrics from visible updates', () => {
    mockUseSituationUpdates.mockReturnValue({
      updates: [
        {
          id: 'sit-1',
          authorUid: 'citizen-1',
          createdAt: Date.now(),
          municipalityLabel: 'Daet',
          barangayLabel: 'San Jose',
          hazardType: 'typhoon',
          condition: 'needs_help',
          body: 'Need updates from the river side.',
          visibility: 'public',
          reportedCount: 0,
        },
        {
          id: 'sit-2',
          authorUid: 'citizen-2',
          createdAt: Date.now(),
          municipalityLabel: 'Labo',
          barangayLabel: 'Talobatib',
          hazardType: 'flood',
          condition: 'flooding',
          body: 'Water is rising but the main road is passable.',
          visibility: 'public',
          reportedCount: 0,
        },
      ],
      loading: false,
      error: null,
    })
    renderFeedTab()
    expect(screen.getByText('Community Pulse')).toBeInTheDocument()
    expect(screen.getByText('2 updates')).toBeInTheDocument()
    expect(screen.getByText('1 needs help')).toBeInTheDocument()
    expect(screen.getByText('2 areas')).toBeInTheDocument()
  })

  it('renders Facebook-style accessible feed posts without highlights strip', () => {
    mockUseSituationUpdates.mockReturnValue({
      updates: [
        {
          id: 'sit-1',
          authorUid: 'citizen-1',
          createdAt: Date.now(),
          municipalityLabel: 'Daet',
          barangayLabel: 'San Jose',
          hazardType: 'flood',
          condition: 'flooding',
          body: 'Flood water is past the sidewalk near the market.',
          visibility: 'public',
          reportedCount: 0,
        },
      ],
      loading: false,
      error: null,
    })
    renderFeedTab()
    expect(screen.getByRole('feed', { name: 'Community situation feed' })).toBeInTheDocument()
    expect(
      screen.getByRole('article', { name: /Flood update in San Jose, Daet/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Citizen update')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /report post/i })).toBeInTheDocument()
    expect(screen.queryByText(/highlights/i)).not.toBeInTheDocument()
  })

  it('submits a community situation update from the composer', async () => {
    renderFeedTab()
    fireEvent.click(screen.getByRole('button', { name: /What's happening\? Share an update/i }))
    fireEvent.change(screen.getByLabelText('Municipality'), { target: { value: 'Labo' } })
    fireEvent.change(screen.getByLabelText('Barangay (optional)'), {
      target: { value: 'Talobatib' },
    })
    fireEvent.change(screen.getByLabelText('Situation type'), {
      target: { value: 'flood' },
    })
    fireEvent.change(screen.getByLabelText('Current condition'), {
      target: { value: 'flooding' },
    })
    fireEvent.change(screen.getByLabelText('Share situation update'), {
      target: { value: '  Waist-deep flood near the bridge.  ' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Post update' }))

    await waitFor(() => {
      expect(mockCreateSituationUpdate).toHaveBeenCalledWith({
        municipalityId: 'labo',
        municipalityLabel: 'Labo',
        barangayLabel: 'Talobatib',
        hazardType: 'flood',
        condition: 'flooding',
        body: 'Waist-deep flood near the bridge.',
      })
    })
    expect(screen.getByText('Update posted')).toBeInTheDocument()
  })

  it('reports a post for moderation', async () => {
    mockUseSituationUpdates.mockReturnValue({
      updates: [
        {
          id: 'sit-1',
          authorUid: 'citizen-1',
          createdAt: Date.now(),
          municipalityLabel: 'Daet',
          barangayLabel: 'San Jose',
          hazardType: 'typhoon',
          condition: 'heavy_rain',
          body: 'Strong rain and ankle-deep water near the market.',
          visibility: 'public',
          reportedCount: 0,
        },
      ],
      loading: false,
      error: null,
    })
    renderFeedTab()
    const post = screen.getByRole('article', { name: /Typhoon update in San Jose, Daet/i })
    fireEvent.click(within(post).getByRole('button', { name: /report post/i }))

    await waitFor(() => {
      expect(mockReportSituationUpdate).toHaveBeenCalledWith('sit-1', 'Needs review')
    })
  })
})

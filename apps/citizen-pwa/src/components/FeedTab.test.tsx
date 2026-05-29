import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { FeedTab } from './FeedTab'

const {
  mockUseSituationUpdates,
  mockCreateSituationUpdate,
  mockReportSituationUpdate,
  mockHasFirebaseConfig,
} = vi.hoisted(() => ({
  mockUseSituationUpdates: vi.fn(),
  mockCreateSituationUpdate: vi.fn().mockResolvedValue(undefined),
  mockReportSituationUpdate: vi.fn().mockResolvedValue(undefined),
  mockHasFirebaseConfig: vi.fn().mockReturnValue(true),
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
    mockHasFirebaseConfig.mockReturnValue(true)
    mockCreateSituationUpdate.mockResolvedValue(undefined)
    mockReportSituationUpdate.mockResolvedValue(undefined)
    mockUseSituationUpdates.mockReturnValue({ updates: [], loading: false, error: null })
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
    expect(screen.getByLabelText('Municipality')).toHaveValue('Labo')
  })

  it('shows loading skeletons when loading=true', () => {
    mockUseSituationUpdates.mockReturnValue({ updates: [], loading: true, error: null })
    renderFeedTab()
    expect(screen.getByText('Situation Feed')).toBeInTheDocument()
    expect(screen.queryByText('No situation updates')).not.toBeInTheDocument()
  })

  it('shows error state when error is set', () => {
    mockUseSituationUpdates.mockReturnValue({
      updates: [],
      loading: false,
      error: new Error('Server error'),
    })
    renderFeedTab()
    expect(screen.getByText('Could not load situation updates')).toBeInTheDocument()
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

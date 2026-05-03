import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { FeedTab } from './FeedTab'

const mockUsePublicIncidents = vi.fn()

vi.mock('../hooks/usePublicIncidents.js', () => ({
  usePublicIncidents: (...args: unknown[]) => {
    const result = mockUsePublicIncidents(...args)
    return result as { incidents: unknown[]; loading: boolean; error: Error | null }
  },
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
    mockUsePublicIncidents.mockReturnValue({ incidents: [], loading: false, error: null })
  })

  it('renders without crashing', () => {
    const { container } = renderFeedTab()
    expect(container).toBeInTheDocument()
  })

  it('shows empty state when no incidents', () => {
    renderFeedTab()
    expect(screen.getByText('No incidents')).toBeInTheDocument()
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

  it('shows loading skeletons when loading=true', () => {
    mockUsePublicIncidents.mockReturnValue({ incidents: [], loading: true, error: null })
    renderFeedTab()
    expect(screen.getByText('Incident Feed')).toBeInTheDocument()
    expect(screen.queryByText('No incidents')).not.toBeInTheDocument()
  })

  it('shows error state when error is set', () => {
    mockUsePublicIncidents.mockReturnValue({
      incidents: [],
      loading: false,
      error: new Error('Server error'),
    })
    renderFeedTab()
    expect(screen.getByText('Could not load incidents')).toBeInTheDocument()
  })

  it('renders incident cards when data is present', () => {
    mockUsePublicIncidents.mockReturnValue({
      incidents: [
        {
          id: 'inc-1',
          reportType: 'flood',
          severity: 'high',
          status: 'verified',
          submittedAt: Date.now(),
          barangayId: 'San Jose',
          municipalityLabel: 'Daet',
          publicLocation: { lat: 14.1, lng: 122.9 },
        },
      ],
      loading: false,
      error: null,
    })
    renderFeedTab()
    expect(screen.getByText('Flood')).toBeInTheDocument()
    expect(screen.getByText('HIGH')).toBeInTheDocument()
    expect(screen.getByText('Track')).toBeInTheDocument()
  })
})

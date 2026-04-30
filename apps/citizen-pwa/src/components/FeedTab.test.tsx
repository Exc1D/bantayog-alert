import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { FeedTab } from './FeedTab'

vi.mock('../hooks/usePublicIncidents.js', () => ({
  usePublicIncidents: () => ({ incidents: [], loading: false, error: null }),
}))

function renderFeedTab() {
  return render(
    <MemoryRouter>
      <FeedTab />
    </MemoryRouter>,
  )
}

describe('FeedTab', () => {
  it('renders without crashing', () => {
    const { container } = renderFeedTab()
    expect(container).toBeInTheDocument()
  })

  it('shows empty state when no incidents', () => {
    renderFeedTab()
    expect(screen.getByText('All clear')).toBeInTheDocument()
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
})

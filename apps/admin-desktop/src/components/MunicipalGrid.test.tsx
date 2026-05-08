import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MunicipalGrid, type MunicipalityData } from '../components/MunicipalGrid'

const mockMunicipalities: MunicipalityData[] = [
  { name: 'Basud', activeIncidents: 0, avgResponseTimeMinutes: null, status: 'responsive' },
  { name: 'Capalonga', activeIncidents: 2, avgResponseTimeMinutes: 8, status: 'responsive' },
  { name: 'Daet', activeIncidents: 5, avgResponseTimeMinutes: 12, status: 'slow' },
  { name: 'Jose Panganiban', activeIncidents: 1, avgResponseTimeMinutes: 6, status: 'responsive' },
  { name: 'Labo', activeIncidents: 8, avgResponseTimeMinutes: 25, status: 'delayed' },
  { name: 'Mercedes', activeIncidents: 3, avgResponseTimeMinutes: 15, status: 'slow' },
  { name: 'Paracale', activeIncidents: 0, avgResponseTimeMinutes: null, status: 'responsive' },
  { name: 'San Lorenzo Ruiz', activeIncidents: 1, avgResponseTimeMinutes: 9, status: 'responsive' },
  { name: 'San Vicente', activeIncidents: 0, avgResponseTimeMinutes: null, status: 'responsive' },
  { name: 'Sta. Elena', activeIncidents: 4, avgResponseTimeMinutes: 18, status: 'slow' },
  { name: 'Talisay', activeIncidents: 0, avgResponseTimeMinutes: null, status: 'responsive' },
  { name: 'Vinzons', activeIncidents: 2, avgResponseTimeMinutes: 11, status: 'slow' },
]

describe('MunicipalGrid', () => {
  const mockOnMunicipalityClick = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders all 12 municipalities', () => {
    render(
      <MunicipalGrid
        municipalities={mockMunicipalities}
        onMunicipalityClick={mockOnMunicipalityClick}
      />,
    )

    mockMunicipalities.forEach((m) => {
      expect(screen.getByText(m.name)).toBeInTheDocument()
    })
  })

  it('displays active incident count for each municipality', () => {
    render(
      <MunicipalGrid
        municipalities={mockMunicipalities}
        onMunicipalityClick={mockOnMunicipalityClick}
      />,
    )

    // Check for specific municipality cards containing the counts
    const basudCard = screen.getByText('Basud').closest('button')
    const daetCard = screen.getByText('Daet').closest('button')
    const laboCard = screen.getByText('Labo').closest('button')

    expect(basudCard?.textContent).toContain('0')
    expect(daetCard?.textContent).toContain('5')
    expect(laboCard?.textContent).toContain('8')
  })

  it('displays dash for null response time', () => {
    render(
      <MunicipalGrid
        municipalities={mockMunicipalities}
        onMunicipalityClick={mockOnMunicipalityClick}
      />,
    )

    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThan(0)
  })

  it('displays response time in minutes', () => {
    render(
      <MunicipalGrid
        municipalities={mockMunicipalities}
        onMunicipalityClick={mockOnMunicipalityClick}
      />,
    )

    expect(screen.getByText('8 min')).toBeInTheDocument()
    expect(screen.getByText('12 min')).toBeInTheDocument()
    expect(screen.getByText('25 min')).toBeInTheDocument()
  })

  it('shows responsive status indicator', () => {
    render(
      <MunicipalGrid
        municipalities={mockMunicipalities}
        onMunicipalityClick={mockOnMunicipalityClick}
      />,
    )

    // Check Basud card specifically for responsive status
    const basudCard = screen.getByText('Basud').closest('button')
    expect(basudCard?.textContent).toContain('Responsive')
  })

  it('shows empty state when all municipalities have 0 incidents', () => {
    const allClearMunicipalities: MunicipalityData[] = [
      { name: 'Basud', activeIncidents: 0, avgResponseTimeMinutes: null, status: 'responsive' },
      { name: 'Capalonga', activeIncidents: 0, avgResponseTimeMinutes: null, status: 'responsive' },
      { name: 'Daet', activeIncidents: 0, avgResponseTimeMinutes: null, status: 'responsive' },
    ]

    render(
      <MunicipalGrid
        municipalities={allClearMunicipalities}
        onMunicipalityClick={mockOnMunicipalityClick}
      />,
    )

    expect(screen.getByTestId('municipal-grid-empty-state')).toBeInTheDocument()
    expect(screen.getByText('All Clear')).toBeInTheDocument()
    expect(screen.getByText(/All municipalities reporting normal status/i)).toBeInTheDocument()
  })

  it('does not show empty state when incidents exist', () => {
    render(
      <MunicipalGrid
        municipalities={mockMunicipalities}
        onMunicipalityClick={mockOnMunicipalityClick}
      />,
    )

    expect(screen.queryByTestId('municipal-grid-empty-state')).not.toBeInTheDocument()
  })

  it('shows slow status indicator', () => {
    render(
      <MunicipalGrid
        municipalities={mockMunicipalities}
        onMunicipalityClick={mockOnMunicipalityClick}
      />,
    )

    // Check Daet card specifically for slow status
    const daetCard = screen.getByText('Daet').closest('button')
    expect(daetCard?.textContent).toContain('Slow')
  })

  it('shows delayed status indicator', () => {
    render(
      <MunicipalGrid
        municipalities={mockMunicipalities}
        onMunicipalityClick={mockOnMunicipalityClick}
      />,
    )

    expect(screen.getByText('Delayed')).toBeInTheDocument()
  })

  it('calls onMunicipalityClick when card is clicked', async () => {
    const user = userEvent.setup()
    render(
      <MunicipalGrid
        municipalities={mockMunicipalities}
        onMunicipalityClick={mockOnMunicipalityClick}
      />,
    )

    const daetCard = screen.getByText('Daet').closest('button')
    if (daetCard) {
      await user.click(daetCard)
      expect(mockOnMunicipalityClick).toHaveBeenCalledWith('Daet')
    }
  })

  it('sorts by response time when selected', async () => {
    const user = userEvent.setup()
    render(
      <MunicipalGrid
        municipalities={mockMunicipalities}
        onMunicipalityClick={mockOnMunicipalityClick}
      />,
    )

    const sortSelect = screen.getByRole('combobox')
    await user.selectOptions(sortSelect, 'responseTime')

    // Labo (25 min) should appear before Daet (12 min) when sorted by response time
    const cards = screen.getAllByRole('button')
    const laboIndex = cards.findIndex((card) => card.textContent.includes('Labo'))
    const daetIndex = cards.findIndex((card) => card.textContent.includes('Daet'))

    expect(laboIndex).toBeLessThan(daetIndex)
  })

  it('sorts by active count when selected', async () => {
    const user = userEvent.setup()
    render(
      <MunicipalGrid
        municipalities={mockMunicipalities}
        onMunicipalityClick={mockOnMunicipalityClick}
      />,
    )

    const sortSelect = screen.getByRole('combobox')
    await user.selectOptions(sortSelect, 'activeCount')

    // Labo (8) should appear before Daet (5) when sorted by active count
    const cards = screen.getAllByRole('button')
    const laboIndex = cards.findIndex((card) => card.textContent.includes('Labo'))
    const daetIndex = cards.findIndex((card) => card.textContent.includes('Daet'))

    expect(laboIndex).toBeLessThan(daetIndex)
  })
})

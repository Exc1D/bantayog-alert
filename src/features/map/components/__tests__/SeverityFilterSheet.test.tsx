import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SeverityFilterSheet } from '../SeverityFilterSheet'
import type { DisasterReport } from '../../types'

describe('SeverityFilterSheet', () => {
  const mockReports: DisasterReport[] = [
    {
      id: '1',
      incidentType: 'flood',
      severity: 'critical',
      status: 'pending',
      timestamp: Date.now(),
      location: { latitude: 14.5, longitude: 120.9 },
    },
    {
      id: '2',
      incidentType: 'fire',
      severity: 'high',
      status: 'pending',
      timestamp: Date.now(),
      location: { latitude: 14.6, longitude: 121.0 },
    },
    {
      id: '3',
      incidentType: 'earthquake',
      severity: 'high',
      status: 'pending',
      timestamp: Date.now(),
      location: { latitude: 14.7, longitude: 121.1 },
    },
    {
      id: '4',
      incidentType: 'landslide',
      severity: 'medium',
      status: 'pending',
      timestamp: Date.now(),
      location: { latitude: 14.8, longitude: 121.2 },
    },
    {
      id: '5',
      incidentType: 'typhoon',
      severity: 'low',
      status: 'pending',
      timestamp: Date.now(),
      location: { latitude: 14.9, longitude: 121.3 },
    },
  ]

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    selectedSeverities: [] as Array<'critical' | 'high' | 'medium' | 'low'>,
    onToggleSeverity: vi.fn(),
    onClearFilters: vi.fn(),
    reports: mockReports,
  }

  it('should render when open', () => {
    render(<SeverityFilterSheet {...defaultProps} />)

    expect(screen.getByText('Filter by Severity')).toBeInTheDocument()
    expect(screen.getByTestId('severity-filter-sheet')).toBeInTheDocument()
  })

  it('should not render when closed', () => {
    render(<SeverityFilterSheet {...defaultProps} isOpen={false} />)

    expect(screen.queryByText('Filter by Severity')).not.toBeInTheDocument()
  })

  it('should display report count summary', () => {
    render(<SeverityFilterSheet {...defaultProps} />)

    expect(screen.getByText('5 reports in your area')).toBeInTheDocument()
  })

  it('should display all severity options with counts', () => {
    render(<SeverityFilterSheet {...defaultProps} />)

    // Check severity labels
    expect(screen.getByText('Critical')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getByText('Medium')).toBeInTheDocument()
    expect(screen.getByText('Low')).toBeInTheDocument()

    // Check counts
    expect(screen.getByTestId('severity-count-critical')).toHaveTextContent('1')
    expect(screen.getByTestId('severity-count-high')).toHaveTextContent('2')
    expect(screen.getByTestId('severity-count-medium')).toHaveTextContent('1')
    expect(screen.getByTestId('severity-count-low')).toHaveTextContent('1')
  })

  it('should show checkboxes unchecked when no severities selected', () => {
    render(<SeverityFilterSheet {...defaultProps} />)

    expect(screen.getByTestId('severity-checkbox-critical')).not.toBeChecked()
    expect(screen.getByTestId('severity-checkbox-high')).not.toBeChecked()
    expect(screen.getByTestId('severity-checkbox-medium')).not.toBeChecked()
    expect(screen.getByTestId('severity-checkbox-low')).not.toBeChecked()
  })

  it('should show checkboxes checked when severities selected', () => {
    render(
      <SeverityFilterSheet
        {...defaultProps}
        selectedSeverities={['critical', 'high']}
      />
    )

    expect(screen.getByTestId('severity-checkbox-critical')).toBeChecked()
    expect(screen.getByTestId('severity-checkbox-high')).toBeChecked()
    expect(screen.getByTestId('severity-checkbox-medium')).not.toBeChecked()
    expect(screen.getByTestId('severity-checkbox-low')).not.toBeChecked()
  })

  it('should toggle checkbox when clicked', async () => {
    const user = userEvent.setup()
    render(<SeverityFilterSheet {...defaultProps} />)

    const checkbox = screen.getByTestId('severity-checkbox-critical')
    expect(checkbox).not.toBeChecked()

    await user.click(checkbox)
    expect(checkbox).toBeChecked()

    await user.click(checkbox)
    expect(checkbox).not.toBeChecked()
  })

  it('should call onClearFilters when Clear All button clicked', async () => {
    const user = userEvent.setup()
    render(
      <SeverityFilterSheet
        {...defaultProps}
        selectedSeverities={['high']}
      />
    )

    const clearButton = screen.getByTestId('clear-filters-button')
    await user.click(clearButton)

    expect(defaultProps.onClearFilters).toHaveBeenCalledTimes(1)
  })

  it('should disable Clear All button when no filters selected', () => {
    render(<SeverityFilterSheet {...defaultProps} />)

    const clearButton = screen.getByTestId('clear-filters-button')
    expect(clearButton).toBeDisabled()
  })

  it('should call onClose when Apply button clicked', async () => {
    const user = userEvent.setup()
    render(<SeverityFilterSheet {...defaultProps} />)

    const applyButton = screen.getByTestId('apply-filters-button')
    await user.click(applyButton)

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })

  it('should apply selected filters when Apply button clicked', async () => {
    const user = userEvent.setup()
    const onToggleSeverity = vi.fn()

    render(
      <SeverityFilterSheet
        {...defaultProps}
        onToggleSeverity={onToggleSeverity}
      />
    )

    // Select two severities
    await user.click(screen.getByTestId('severity-checkbox-critical'))
    await user.click(screen.getByTestId('severity-checkbox-high'))

    // Apply filters
    await user.click(screen.getByTestId('apply-filters-button'))

    expect(onToggleSeverity).toHaveBeenCalledWith('critical')
    expect(onToggleSeverity).toHaveBeenCalledWith('high')
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('should close modal when backdrop clicked', async () => {
    const user = userEvent.setup()
    render(<SeverityFilterSheet {...defaultProps} />)

    const backdrop = screen.getByTestId('modal-backdrop')
    await user.click(backdrop)

    expect(defaultProps.onClose).toHaveBeenCalled()
  })
})

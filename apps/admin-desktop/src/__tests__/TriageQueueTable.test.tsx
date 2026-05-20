import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TriageQueueTable } from '../components/TriageQueueTable'

const mockReports = [
  {
    id: 'r1',
    type: 'flood' as const,
    severity: 'high' as const,
    municipality: 'Daet',
    barangay: 'Camambugan',
    createdAt: '14:02',
    status: 'new' as const,
    description: '',
    reporterName: '',
    reporterPhone: '',
    latitude: 0,
    longitude: 0,
    updatedAt: '',
  },
  {
    id: 'r2',
    type: 'fire' as const,
    severity: 'medium' as const,
    municipality: 'Labo',
    barangay: 'San Roque',
    createdAt: '14:08',
    status: 'new' as const,
    description: '',
    reporterName: '',
    reporterPhone: '',
    latitude: 0,
    longitude: 0,
    updatedAt: '',
  },
]

function renderTable(props: Partial<Parameters<typeof TriageQueueTable>[0]> = {}) {
  return render(
    <TriageQueueTable
      reports={mockReports}
      selectedIds={new Set()}
      onToggleSelect={vi.fn()}
      onSelectAll={vi.fn()}
      onVerify={vi.fn()}
      onReject={vi.fn()}
      onDispatch={vi.fn()}
      onRowClick={vi.fn()}
      onBulkVerify={vi.fn()}
      onBulkReject={vi.fn()}
      {...props}
    />,
  )
}

describe('TriageQueueTable', () => {
  it('renders empty state when no reports', () => {
    render(
      <TriageQueueTable
        reports={[]}
        selectedIds={new Set()}
        onToggleSelect={vi.fn()}
        onSelectAll={vi.fn()}
        onVerify={vi.fn()}
        onReject={vi.fn()}
        onDispatch={vi.fn()}
        onRowClick={vi.fn()}
      />,
    )
    expect(screen.getByText('All Caught Up')).toBeInTheDocument()
  })

  it('renders report rows', () => {
    renderTable()
    expect(screen.getByText('Daet')).toBeInTheDocument()
    expect(screen.getByTestId('report-row-r1')).toBeInTheDocument()
    expect(screen.getByTestId('report-row-r2')).toBeInTheDocument()
  })

  it('calls onVerify when verify clicked', async () => {
    const user = userEvent.setup()
    const onVerify = vi.fn()
    renderTable({ onVerify })
    const verifyButtons = screen.getAllByRole('button', { name: 'Verify' })
    await user.click(verifyButtons[0]!)
    expect(onVerify).toHaveBeenCalledWith('r1')
  })

  it('shows bulk action bar when items selected', () => {
    renderTable({ selectedIds: new Set(['r1']) })
    expect(screen.getByText('1 selected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Verify Selected' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reject Selected' })).toBeInTheDocument()
  })

  it('calls onBulkVerify with selected ids when bulk verify clicked', async () => {
    const user = userEvent.setup()
    const onBulkVerify = vi.fn()
    renderTable({ selectedIds: new Set(['r1', 'r2']), onBulkVerify })
    await user.click(screen.getByRole('button', { name: 'Verify Selected' }))
    expect(onBulkVerify).toHaveBeenCalledWith(new Set(['r1', 'r2']))
  })

  it('calls onBulkReject with selected ids when bulk reject clicked', async () => {
    const user = userEvent.setup()
    const onBulkReject = vi.fn()
    renderTable({ selectedIds: new Set(['r1']), onBulkReject })
    await user.click(screen.getByRole('button', { name: 'Reject Selected' }))
    expect(onBulkReject).toHaveBeenCalledWith(new Set(['r1']))
  })

  it('does not show bulk bar when nothing selected', () => {
    renderTable({ selectedIds: new Set() })
    expect(screen.queryByText('selected')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Verify Selected' })).not.toBeInTheDocument()
  })

  it('renders thead with sticky positioning so headers stay visible during dashboard scroll', () => {
    const { container } = renderTable()
    const thead = container.querySelector('thead')
    expect(thead).not.toBeNull()
    expect(thead?.className).toContain('sticky')
    expect(thead?.className).toContain('top-0')
    // Background must match the card surface so tbody rows scrolling beneath
    // the sticky thead don't bleed through.
    expect(thead?.className).toContain('bg-[var(--color-surface-elevated)]')
  })

  it('renders the bulk-action bar sticky above the sticky thead', () => {
    const { container } = renderTable({ selectedIds: new Set(['r1']) })
    const bulkBar = container.querySelector('[data-testid="bulk-action-bar"]')
    expect(bulkBar).not.toBeNull()
    expect(bulkBar?.className).toContain('sticky')
    expect(bulkBar?.className).toContain('top-0')
    // z-20 so it pins ABOVE the z-10 thead.
    expect(bulkBar?.className).toContain('z-20')
    expect(bulkBar?.className).toContain('bg-[var(--color-surface-elevated)]')
  })
})

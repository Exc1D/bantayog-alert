import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TriageQueueTable } from '../components/TriageQueueTable'

const mockReports = [
  {
    id: 'r1',
    type: 'FLOOD' as const,
    severity: 'HIGH' as const,
    municipality: 'Daet',
    barangay: 'Camambugan',
    createdAt: '14:02',
    status: 'PENDING' as const,
    description: '',
    reporterName: '',
    reporterPhone: '',
    latitude: 0,
    longitude: 0,
    updatedAt: '',
  },
  {
    id: 'r2',
    type: 'FIRE' as const,
    severity: 'MEDIUM' as const,
    municipality: 'Labo',
    barangay: 'San Roque',
    createdAt: '14:08',
    status: 'PENDING' as const,
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
})

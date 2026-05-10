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
]

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
    render(
      <TriageQueueTable
        reports={mockReports}
        selectedIds={new Set()}
        onToggleSelect={vi.fn()}
        onSelectAll={vi.fn()}
        onVerify={vi.fn()}
        onReject={vi.fn()}
        onDispatch={vi.fn()}
        onRowClick={vi.fn()}
      />,
    )
    expect(screen.getByText('Daet')).toBeInTheDocument()
  })

  it('calls onVerify when verify clicked', async () => {
    const user = userEvent.setup()
    const onVerify = vi.fn()
    render(
      <TriageQueueTable
        reports={mockReports}
        selectedIds={new Set()}
        onToggleSelect={vi.fn()}
        onSelectAll={vi.fn()}
        onVerify={onVerify}
        onReject={vi.fn()}
        onDispatch={vi.fn()}
        onRowClick={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Verify' }))
    expect(onVerify).toHaveBeenCalledWith('r1')
  })
})

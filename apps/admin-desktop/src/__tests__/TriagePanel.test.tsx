import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TriagePanel } from '../components/TriagePanel'

const mockReport = {
  id: 'r1',
  type: 'FLOOD' as const,
  severity: 'HIGH' as const,
  municipality: 'Daet',
  barangay: 'Camambugan',
  description: 'Water rising',
  reporterName: 'Juan',
  reporterPhone: '0917xxx',
  latitude: 14.1,
  longitude: 122.9,
  createdAt: '14:02',
  status: 'PENDING' as const,
  updatedAt: '',
}

describe('TriagePanel', () => {
  it('does not render when no report', () => {
    render(
      <TriagePanel
        report={null}
        onClose={vi.fn()}
        onVerify={vi.fn()}
        onReject={vi.fn()}
        onDispatch={vi.fn()}
      />,
    )
    expect(screen.queryByText('Report Detail')).not.toBeInTheDocument()
  })

  it('renders report details', () => {
    render(
      <TriagePanel
        report={mockReport}
        onClose={vi.fn()}
        onVerify={vi.fn()}
        onReject={vi.fn()}
        onDispatch={vi.fn()}
      />,
    )
    expect(screen.getByText('Water rising')).toBeInTheDocument()
  })

  it('calls onVerify when verify clicked', async () => {
    const user = userEvent.setup()
    const onVerify = vi.fn()
    render(
      <TriagePanel
        report={mockReport}
        onClose={vi.fn()}
        onVerify={onVerify}
        onReject={vi.fn()}
        onDispatch={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Verify' }))
    expect(onVerify).toHaveBeenCalledWith('r1')
  })
})

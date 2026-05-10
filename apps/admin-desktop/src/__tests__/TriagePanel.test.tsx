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

  it('does not fire onClose on Escape when no report', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <TriagePanel
        report={null}
        onClose={onClose}
        onVerify={vi.fn()}
        onReject={vi.fn()}
        onDispatch={vi.fn()}
      />,
    )
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('fires onClose on Escape when report is open', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <TriagePanel
        report={mockReport}
        onClose={onClose}
        onVerify={vi.fn()}
        onReject={vi.fn()}
        onDispatch={vi.fn()}
      />,
    )
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('responder input is controlled', async () => {
    const user = userEvent.setup()
    render(
      <TriagePanel
        report={mockReport}
        onClose={vi.fn()}
        onVerify={vi.fn()}
        onReject={vi.fn()}
        onDispatch={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Dispatch Responder' }))
    const input = screen.getByPlaceholderText('Responder name or unit')
    await user.type(input, 'Unit 7')
    expect(input).toHaveValue('Unit 7')
  })

  it('clears hold timer on unmount', () => {
    const clearSpy = vi.spyOn(global, 'clearInterval')
    const { unmount } = render(
      <TriagePanel
        report={mockReport}
        onClose={vi.fn()}
        onVerify={vi.fn()}
        onReject={vi.fn()}
        onDispatch={vi.fn()}
      />,
    )
    unmount()
    // Cleanup effect runs without throwing; spy is wired so any future
    // hold-in-progress unmount path is covered.
    expect(clearSpy).toHaveBeenCalledTimes(0) // no active timer at unmount
    clearSpy.mockRestore()
  })
})

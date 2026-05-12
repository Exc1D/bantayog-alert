import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, act } from '@testing-library/react'
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

const mockResponders = [
  { uid: 'u1', displayName: 'Alice', agency: 'BFP' },
  { uid: 'u2', displayName: 'Bob', agency: 'PNP' },
  { uid: 'u3', displayName: 'Charlie', agency: 'BFP' },
]

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

  it('has dialog role and aria-modal', () => {
    render(
      <TriagePanel
        report={mockReport}
        onClose={vi.fn()}
        onVerify={vi.fn()}
        onReject={vi.fn()}
        onDispatch={vi.fn()}
      />,
    )
    const panel = screen.getByRole('dialog')
    expect(panel).toHaveAttribute('aria-modal', 'true')
    expect(panel).toHaveAttribute('aria-labelledby', 'triage-panel-title')
  })

  it('shows agency allowlist in dispatch form', async () => {
    const user = userEvent.setup()
    render(
      <TriagePanel
        report={mockReport}
        responders={mockResponders}
        onClose={vi.fn()}
        onVerify={vi.fn()}
        onReject={vi.fn()}
        onDispatch={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Dispatch Responder' }))
    const agencySelect = screen.getByRole('combobox', { name: 'Select Agency' })
    expect(agencySelect).toBeInTheDocument()
    // Agency options should include the allowlist
    expect(screen.getByText('BFP')).toBeInTheDocument()
    expect(screen.getByText('PNP')).toBeInTheDocument()
    expect(screen.getByText('MDRRMO')).toBeInTheDocument()
    expect(screen.getByText('Coast Guard')).toBeInTheDocument()
  })

  it('filters responders by selected agency', async () => {
    const user = userEvent.setup()
    render(
      <TriagePanel
        report={mockReport}
        responders={mockResponders}
        onClose={vi.fn()}
        onVerify={vi.fn()}
        onReject={vi.fn()}
        onDispatch={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Dispatch Responder' }))
    const agencySelect = screen.getByRole('combobox', { name: 'Select Agency' })
    await user.selectOptions(agencySelect, 'BFP')
    // Responder dropdown should appear with BFP responders
    const responderOptions = screen.getAllByRole('option')
    const responderTexts = responderOptions.map((o) => o.textContent)
    expect(responderTexts).toContain('Alice')
    expect(responderTexts).toContain('Charlie')
    expect(responderTexts).not.toContain('Bob')
  })

  it('shows "No responders available" when agency has no responders', async () => {
    const user = userEvent.setup()
    render(
      <TriagePanel
        report={mockReport}
        responders={mockResponders}
        onClose={vi.fn()}
        onVerify={vi.fn()}
        onReject={vi.fn()}
        onDispatch={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Dispatch Responder' }))
    const agencySelect = screen.getByRole('combobox', { name: 'Select Agency' })
    await user.selectOptions(agencySelect, 'MDRRMO')
    expect(screen.getByText('No responders available')).toBeInTheDocument()
  })

  it('clears responder selection when agency changes', async () => {
    const user = userEvent.setup()
    render(
      <TriagePanel
        report={mockReport}
        responders={mockResponders}
        onClose={vi.fn()}
        onVerify={vi.fn()}
        onReject={vi.fn()}
        onDispatch={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Dispatch Responder' }))
    const agencySelect = screen.getByRole('combobox', { name: 'Select Agency' })
    await user.selectOptions(agencySelect, 'BFP')
    // Select a responder
    const allComboboxes = screen.getAllByRole('combobox')
    const responderSelect = allComboboxes[1]
    if (!responderSelect) throw new Error('Responder select not found')
    await user.selectOptions(responderSelect, 'u1')
    // Change agency
    await user.selectOptions(agencySelect, 'PNP')
    // Responder dropdown should now show PNP options only
    const responderOptions = screen.getAllByRole('option')
    const responderTexts = responderOptions.map((o) => o.textContent)
    expect(responderTexts).toContain('Bob')
    expect(responderTexts).not.toContain('Alice')
  })

  it('triggers dispatch via keyboard Space hold for 1000ms', () => {
    vi.useFakeTimers()
    const onDispatch = vi.fn()
    render(
      <TriagePanel
        report={mockReport}
        responders={mockResponders}
        onClose={vi.fn()}
        onVerify={vi.fn()}
        onReject={vi.fn()}
        onDispatch={onDispatch}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /dispatch responder/i }))
    const agencySelect = screen.getByRole('combobox', { name: /select agency/i })
    fireEvent.change(agencySelect, { target: { value: 'BFP' } })
    // Re-query after agency selection renders responder dropdown
    const responderSelect = screen.getByRole('combobox', { name: /select responder/i })
    fireEvent.change(responderSelect, { target: { value: 'u1' } })

    const holdButton = screen.getByRole('button', { name: /hold to dispatch/i })
    holdButton.focus()
    fireEvent.keyDown(holdButton, { key: ' ' })
    act(() => {
      vi.advanceTimersByTime(1100)
    })
    fireEvent.keyUp(holdButton, { key: ' ' })

    expect(onDispatch).toHaveBeenCalledWith(mockReport.id, 'BFP', 'u1')
    vi.useRealTimers()
  })

  it('does not re-trigger dispatch when keydown repeats', () => {
    vi.useFakeTimers()
    const onDispatch = vi.fn()
    render(
      <TriagePanel
        report={mockReport}
        responders={mockResponders}
        onClose={vi.fn()}
        onVerify={vi.fn()}
        onReject={vi.fn()}
        onDispatch={onDispatch}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /dispatch responder/i }))
    const agencySelect2 = screen.getByRole('combobox', { name: /select agency/i })
    fireEvent.change(agencySelect2, { target: { value: 'BFP' } })
    const responderSelect2 = screen.getByRole('combobox', { name: /select responder/i })
    fireEvent.change(responderSelect2, { target: { value: 'u1' } })

    const holdButton = screen.getByRole('button', { name: /hold to dispatch/i })
    holdButton.focus()
    fireEvent.keyDown(holdButton, { key: ' ' })
    fireEvent.keyDown(holdButton, { key: ' ', repeat: true })
    fireEvent.keyDown(holdButton, { key: ' ', repeat: true })
    act(() => {
      vi.advanceTimersByTime(1100)
    })
    fireEvent.keyUp(holdButton, { key: ' ' })

    expect(onDispatch).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})

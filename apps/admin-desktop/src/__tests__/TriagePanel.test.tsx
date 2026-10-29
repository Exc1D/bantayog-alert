import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { TriagePanel } from '../components/TriagePanel'

const mockReport = {
  id: 'r1',
  type: 'flood' as const,
  severity: 'high' as const,
  municipality: 'Daet',
  barangay: 'Camambugan',
  description: 'Water rising',
  reporterName: 'Juan',
  reporterPhone: '0917xxx',
  latitude: 14.1,
  longitude: 122.9,
  createdAt: '14:02',
  status: 'new' as const,
  updatedAt: '',
}
const awaitingReport = { ...mockReport, status: 'awaiting_verify' as const }
const verifiedReport = { ...mockReport, status: 'verified' as const }
const assignedReport = { ...mockReport, status: 'assigned' as const }
const acknowledgedReport = { ...mockReport, status: 'acknowledged' as const }

const verifiedReport2 = { ...mockReport, id: 'r2', status: 'verified' as const }

const mockResponders = [
  { uid: 'u1', displayName: 'Alice', agency: 'BFP' },
  { uid: 'u2', displayName: 'Bob', agency: 'PNP' },
  { uid: 'u3', displayName: 'Charlie', agency: 'BFP' },
]

type PanelProps = ComponentProps<typeof TriagePanel>

function panelProps(overrides: Partial<PanelProps> = {}): PanelProps {
  return {
    report: verifiedReport,
    onClose: vi.fn(),
    onVerify: vi.fn(),
    onReject: vi.fn(),
    onDispatch: vi.fn(),
    ...overrides,
  }
}

function renderPanel(overrides: Partial<PanelProps> = {}) {
  return render(<TriagePanel {...panelProps(overrides)} />)
}

describe('TriagePanel', () => {
  it('resets dispatch state when report changes', async () => {
    const user = userEvent.setup()
    const { rerender } = renderPanel({ responders: mockResponders })

    await user.click(screen.getByRole('button', { name: 'Dispatch Responder' }))
    expect(screen.getByRole('combobox', { name: 'Select Agency' })).toBeInTheDocument()

    // Switch to a different report that still allows dispatch
    rerender(
      <TriagePanel {...panelProps({ report: verifiedReport2, responders: mockResponders })} />,
    )

    // Dispatch form should be closed
    expect(screen.queryByRole('combobox', { name: 'Select Agency' })).not.toBeInTheDocument()
    // Hold button should not be present
    expect(screen.queryByRole('button', { name: /hold to dispatch/i })).not.toBeInTheDocument()
  })

  it('does not render when no report', () => {
    renderPanel({ report: null })
    expect(screen.queryByText('Report Detail')).not.toBeInTheDocument()
  })

  it('renders report details', () => {
    renderPanel({ report: awaitingReport })
    expect(screen.getByText('Water rising')).toBeInTheDocument()
  })

  it('calls onVerify when verify clicked', async () => {
    const user = userEvent.setup()
    const onVerify = vi.fn()
    renderPanel({ report: awaitingReport, onVerify })
    await user.click(screen.getByRole('button', { name: 'Verify' }))
    expect(onVerify).toHaveBeenCalledWith('r1')
  })

  it('handles async reject failures at the panel boundary', async () => {
    const user = userEvent.setup()
    const error = new Error('reject failed')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderPanel({ report: awaitingReport, onReject: vi.fn().mockRejectedValue(error) })

    await user.click(screen.getByRole('button', { name: 'Reject' }))

    try {
      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Report rejection failed', error)
      })
    } finally {
      consoleError.mockRestore()
    }
  })

  it('has dialog role and aria-modal', () => {
    renderPanel()
    const panel = screen.getByRole('dialog')
    expect(panel).toHaveAttribute('aria-modal', 'true')
    expect(panel).toHaveAttribute('aria-labelledby', 'triage-panel-title')
    expect(screen.getByTestId('triage-panel-r1')).toBeInTheDocument()
  })

  it('shows agency allowlist in dispatch form', async () => {
    const user = userEvent.setup()
    renderPanel({ responders: mockResponders })
    await user.click(screen.getByRole('button', { name: 'Dispatch Responder' }))
    const agencySelect = screen.getByRole('combobox', { name: 'Select Agency' })
    expect(agencySelect).toBeInTheDocument()
    // Agency options should include the allowlist
    expect(screen.getByText('BFP')).toBeInTheDocument()
    expect(screen.getByText('PNP')).toBeInTheDocument()
    expect(screen.getByText('MDRRMO')).toBeInTheDocument()
    expect(screen.getByText('Coast Guard')).toBeInTheDocument()
  })

  it.each([
    ['assigned', assignedReport],
    ['acknowledged', acknowledgedReport],
  ])('does not expose dispatch controls for %s reports', (_status, report) => {
    const onDispatch = vi.fn()
    renderPanel({ report, responders: mockResponders, onDispatch })

    expect(screen.queryByRole('button', { name: 'Dispatch Responder' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /hold to dispatch/i })).not.toBeInTheDocument()
    expect(onDispatch).not.toHaveBeenCalled()
  })

  it('filters responders by selected agency', async () => {
    const user = userEvent.setup()
    renderPanel({ responders: mockResponders })
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
    renderPanel({ responders: mockResponders })
    await user.click(screen.getByRole('button', { name: 'Dispatch Responder' }))
    const agencySelect = screen.getByRole('combobox', { name: 'Select Agency' })
    await user.selectOptions(agencySelect, 'MDRRMO')
    expect(screen.getByText('No responders available')).toBeInTheDocument()
  })

  it('clears responder selection when agency changes', async () => {
    const user = userEvent.setup()
    renderPanel({ responders: mockResponders })
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
    renderPanel({ responders: mockResponders, onDispatch })

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

    expect(onDispatch).toHaveBeenCalledWith(verifiedReport.id, 'BFP', 'u1')
    vi.useRealTimers()
  })

  it('does not re-trigger dispatch when keydown repeats', () => {
    vi.useFakeTimers()
    const onDispatch = vi.fn()
    renderPanel({ responders: mockResponders, onDispatch })
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

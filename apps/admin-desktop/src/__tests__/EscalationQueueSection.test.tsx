import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { EscalationQueueSection } from '../components/EscalationQueueSection'

const noopReDispatch = vi.fn()

const mockDispatches = [
  {
    dispatchId: 'd-1',
    reportId: 'rep-abc12345',
    responderName: 'Alice Cruz',
    escalationCount: 1,
  },
  {
    dispatchId: 'd-2',
    reportId: 'rep-def67890',
    responderName: 'Bob Santos',
    escalationCount: 3,
  },
]

describe('EscalationQueueSection', () => {
  it('renders all-clear banner when stalledDispatches is empty', () => {
    render(
      <EscalationQueueSection stalledDispatches={[]} onReDispatch={noopReDispatch} mode="active" />,
    )
    expect(screen.getByText(/all clear/i)).toBeInTheDocument()
  })

  it('renders header with AlertTriangle and count when there are stalled dispatches', () => {
    render(
      <EscalationQueueSection
        stalledDispatches={mockDispatches}
        onReDispatch={noopReDispatch}
        mode="surge"
      />,
    )
    expect(screen.getByText('Needs Admin Attention (2)')).toBeInTheDocument()
    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('applies red-themed border and background classes to the section', () => {
    const { container } = render(
      <EscalationQueueSection
        stalledDispatches={mockDispatches}
        onReDispatch={noopReDispatch}
        mode="surge"
      />,
    )
    const section = container.firstChild as HTMLElement
    expect(section.className).toContain('border-[var(--color-danger)]/30')
    expect(section.className).toContain('bg-[var(--color-danger)]/5')
  })

  it('renders a card for each stalled dispatch with report id, responder name and escalation count', () => {
    render(
      <EscalationQueueSection
        stalledDispatches={mockDispatches}
        onReDispatch={noopReDispatch}
        mode="surge"
      />,
    )
    expect(screen.getByText('rep-abc1')).toBeInTheDocument()
    expect(screen.getByText('rep-def6')).toBeInTheDocument()
    expect(screen.getByText((content) => content.includes('Alice Cruz'))).toBeInTheDocument()
    expect(screen.getByText((content) => content.includes('Bob Santos'))).toBeInTheDocument()
    expect(
      screen.getByText((content) => content.includes('Escalated') && content.includes('1x')),
    ).toBeInTheDocument()
    expect(
      screen.getByText((content) => content.includes('Escalated') && content.includes('3x')),
    ).toBeInTheDocument()
  })

  it('shows escalation count in warning color', () => {
    render(
      <EscalationQueueSection
        stalledDispatches={mockDispatches}
        onReDispatch={noopReDispatch}
        mode="surge"
      />,
    )
    const firstEscalation = screen.getByText(
      (content) => content.includes('Escalated') && content.includes('1x'),
    )
    expect(firstEscalation).toHaveClass('text-[var(--color-warning)]')
  })

  it('calls onReDispatch with the dispatchId when Re-dispatch button is clicked', async () => {
    const onReDispatch = vi.fn()
    render(
      <EscalationQueueSection
        stalledDispatches={mockDispatches}
        onReDispatch={onReDispatch}
        mode="surge"
      />,
    )
    const buttons = screen.getAllByRole('button', { name: /Re-dispatch/i })
    expect(buttons).toHaveLength(2)

    await userEvent.click(buttons[1]!)
    expect(onReDispatch).toHaveBeenCalledTimes(1)
    expect(onReDispatch).toHaveBeenCalledWith('d-2')
  })

  it('renders view details link for each stalled dispatch', () => {
    const stalled = [
      { dispatchId: 'd1', reportId: 'rpt_001', responderName: 'Juan', escalationCount: 1 },
    ]
    render(
      <EscalationQueueSection
        stalledDispatches={stalled}
        onReDispatch={noopReDispatch}
        mode="surge"
      />,
    )
    expect(screen.getByText(/view details/i)).toHaveAttribute('href', '/dispatches?highlight=d1')
  })

  // Mode-aware behavior tests
  it('is hidden in calm mode even with stalled dispatches', () => {
    const { container } = render(
      <EscalationQueueSection
        stalledDispatches={mockDispatches}
        onReDispatch={noopReDispatch}
        mode="calm"
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('is visible in surge mode when there are stalled dispatches', () => {
    render(
      <EscalationQueueSection
        stalledDispatches={mockDispatches}
        onReDispatch={noopReDispatch}
        mode="surge"
      />,
    )
    expect(screen.getByText('Needs Admin Attention (2)')).toBeInTheDocument()
  })

  it('shows All clear when empty in active mode', () => {
    render(
      <EscalationQueueSection stalledDispatches={[]} onReDispatch={noopReDispatch} mode="active" />,
    )
    expect(screen.getByText(/all clear/i)).toBeInTheDocument()
  })
})

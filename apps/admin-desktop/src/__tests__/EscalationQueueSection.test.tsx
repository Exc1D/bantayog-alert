import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { EscalationQueueSection } from '../components/EscalationQueueSection'

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
  it('returns null and renders nothing when stalledDispatches is empty', () => {
    const { container } = render(
      <EscalationQueueSection stalledDispatches={[]} onReDispatch={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders header with AlertTriangle and count when there are stalled dispatches', () => {
    render(<EscalationQueueSection stalledDispatches={mockDispatches} onReDispatch={vi.fn()} />)
    expect(screen.getByText('Needs Admin Attention (2)')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /alert/i })).toBeInTheDocument()
  })

  it('applies red-themed border and background classes to the section', () => {
    const { container } = render(
      <EscalationQueueSection stalledDispatches={mockDispatches} onReDispatch={vi.fn()} />,
    )
    const section = container.firstChild as HTMLElement
    expect(section.className).toContain('border-red-500/30')
    expect(section.className).toContain('bg-red-500/5')
  })

  it('renders a card for each stalled dispatch with report id, responder name and escalation count', () => {
    render(<EscalationQueueSection stalledDispatches={mockDispatches} onReDispatch={vi.fn()} />)
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

  it('shows escalation count in amber color', () => {
    render(<EscalationQueueSection stalledDispatches={mockDispatches} onReDispatch={vi.fn()} />)
    const firstEscalation = screen.getByText(
      (content) => content.includes('Escalated') && content.includes('1x'),
    )
    expect(firstEscalation).toHaveClass('text-amber-500')
  })

  it('calls onReDispatch with the dispatchId when Re-dispatch button is clicked', async () => {
    const onReDispatch = vi.fn()
    render(
      <EscalationQueueSection stalledDispatches={mockDispatches} onReDispatch={onReDispatch} />,
    )
    const buttons = screen.getAllByRole('button', { name: /Re-dispatch/i })
    expect(buttons).toHaveLength(2)

    await userEvent.click(buttons[1]!)
    expect(onReDispatch).toHaveBeenCalledTimes(1)
    expect(onReDispatch).toHaveBeenCalledWith('d-2')
  })
})

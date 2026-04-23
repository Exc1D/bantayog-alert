import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PeekSheet } from './PeekSheet.js'

const pin = { id: 'r1', type: 'incident' as const, label: '🌊 Flood · High · Brgy San Jose, Daet' }

describe('PeekSheet', () => {
  it('does not render when hidden', () => {
    const { container } = render(
      <PeekSheet sheetPhase="hidden" pin={pin} onExpand={vi.fn()} onDismiss={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('does not render when expanded', () => {
    const { container } = render(
      <PeekSheet sheetPhase="expanded" pin={pin} onExpand={vi.fn()} onDismiss={vi.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders the label when peek', () => {
    render(<PeekSheet sheetPhase="peek" pin={pin} onExpand={vi.fn()} onDismiss={vi.fn()} />)
    expect(screen.getByText(/Flood/)).toBeInTheDocument()
  })

  it('calls onExpand when tapped', () => {
    const onExpand = vi.fn()
    render(<PeekSheet sheetPhase="peek" pin={pin} onExpand={onExpand} onDismiss={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /pull up/i }))
    expect(onExpand).toHaveBeenCalledOnce()
  })

  it('calls onDismiss on swipe down', () => {
    const onDismiss = vi.fn()
    const { container } = render(
      <PeekSheet sheetPhase="peek" pin={pin} onExpand={vi.fn()} onDismiss={onDismiss} />,
    )
    const sheet = container.querySelector('[data-testid="peek-sheet"]')!
    fireEvent.touchStart(sheet, { touches: [{ clientY: 100 }] })
    fireEvent.touchEnd(sheet, { changedTouches: [{ clientY: 180 }] })
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('calls onExpand on swipe up', () => {
    const onExpand = vi.fn()
    const { container } = render(
      <PeekSheet sheetPhase="peek" pin={pin} onExpand={onExpand} onDismiss={vi.fn()} />,
    )
    const sheet = container.querySelector('[data-testid="peek-sheet"]')!
    fireEvent.touchStart(sheet, { touches: [{ clientY: 180 }] })
    fireEvent.touchEnd(sheet, { changedTouches: [{ clientY: 100 }] })
    expect(onExpand).toHaveBeenCalledOnce()
  })

  it('ignores touch end without a touch point', () => {
    const onDismiss = vi.fn()
    const onExpand = vi.fn()
    const { container } = render(
      <PeekSheet sheetPhase="peek" pin={pin} onExpand={onExpand} onDismiss={onDismiss} />,
    )
    const sheet = container.querySelector('[data-testid="peek-sheet"]')!
    fireEvent.touchStart(sheet, { touches: [{ clientY: 100 }] })
    fireEvent.touchEnd(sheet, { changedTouches: [] })
    expect(onDismiss).not.toHaveBeenCalled()
    expect(onExpand).not.toHaveBeenCalled()
  })
})

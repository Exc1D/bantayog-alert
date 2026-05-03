import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { RadarRings } from './RadarRings.js'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      style,
      className,
    }: React.HTMLAttributes<HTMLDivElement> & { animate?: unknown; transition?: unknown }) => (
      <div className={className} style={style} data-testid="radar-ring">
        {children}
      </div>
    ),
  },
}))

describe('RadarRings', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders three rings with the given border color', () => {
    render(<RadarRings color="#0f9488" />)
    const rings = screen.getAllByTestId('radar-ring')
    expect(rings).toHaveLength(3)
    rings.forEach((ring) => {
      expect(ring).toHaveStyle({ borderColor: '#0f9488' })
    })
  })

  it('hides rings after autoHideMs', () => {
    const { container } = render(<RadarRings color="#0f9488" autoHideMs={6000} />)
    const wrapper = container.firstChild as HTMLDivElement
    expect(wrapper).toBeVisible()

    act(() => {
      vi.advanceTimersByTime(6000)
    })
    expect(wrapper.style.display).toBe('none')
  })

  it('does not auto-hide when autoHideMs is omitted', () => {
    const { container } = render(<RadarRings color="#0f9488" />)
    const wrapper = container.firstChild as HTMLDivElement
    act(() => {
      vi.advanceTimersByTime(60000)
    })
    expect(wrapper.style.display).not.toBe('none')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import { SosHoldButton } from './SosHoldButton'

describe('SosHoldButton', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
  })
  it('renders as disabled when no active dispatch', () => {
    render(
      <MemoryRouter>
        <SosHoldButton activeDispatchId={null} disabled />
      </MemoryRouter>,
    )
    expect(screen.getByRole('button', { name: /sos/i })).toBeDisabled()
  })

  it('navigates to sos page after 3-second hold', () => {
    vi.useFakeTimers()
    render(
      <MemoryRouter>
        <SosHoldButton activeDispatchId="disp-1" disabled={false} />
      </MemoryRouter>,
    )
    const btn = screen.getByRole('button', { name: /sos/i })
    fireEvent.pointerDown(btn)
    act(() => {
      vi.advanceTimersByTime(3100)
    })
    expect(mockNavigate).toHaveBeenCalledWith('/dispatches/disp-1/sos')
    vi.useRealTimers()
  })

  it('does not navigate if hold released early', () => {
    vi.useFakeTimers()
    render(
      <MemoryRouter>
        <SosHoldButton activeDispatchId="disp-1" disabled={false} />
      </MemoryRouter>,
    )
    const btn = screen.getByRole('button', { name: /sos/i })
    fireEvent.pointerDown(btn)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    fireEvent.pointerUp(btn)
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(mockNavigate).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('navigates after 3-second Enter key hold', () => {
    vi.useFakeTimers()
    render(
      <MemoryRouter>
        <SosHoldButton activeDispatchId="disp-1" disabled={false} />
      </MemoryRouter>,
    )
    const btn = screen.getByRole('button', { name: /sos/i })
    fireEvent.keyDown(btn, { key: 'Enter', code: 'Enter' })
    act(() => {
      vi.advanceTimersByTime(3100)
    })
    expect(mockNavigate).toHaveBeenCalledWith('/dispatches/disp-1/sos')
    vi.useRealTimers()
  })

  it('does not navigate if timer fires after component unmounts', () => {
    vi.useFakeTimers()
    const { unmount } = render(
      <MemoryRouter>
        <SosHoldButton activeDispatchId="disp-1" disabled={false} />
      </MemoryRouter>,
    )
    const btn = screen.getByRole('button', { name: /sos/i })
    fireEvent.pointerDown(btn)
    unmount()
    act(() => {
      vi.advanceTimersByTime(3100)
    })
    expect(mockNavigate).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// navigate spy — must be hoisted
const navigateSpy = vi.hoisted(() => vi.fn())
const reportNowSpy = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async (importActual) => {
  const actual = await importActual<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => navigateSpy }
})

vi.mock('../lib/store.js', () => ({
  useUIStore: (sel: (s: { hasCompletedOnboarding: boolean }) => unknown) =>
    sel({ hasCompletedOnboarding: false }),
}))

beforeEach(() => {
  vi.useFakeTimers()
  navigateSpy.mockClear()
  reportNowSpy.mockClear()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('SplashScreen', () => {
  async function renderSplash() {
    const { SplashScreen } = await import('./SplashScreen.js')
    return render(
      <MemoryRouter>
        <SplashScreen onDone={navigateSpy} onReportNow={reportNowSpy} />
      </MemoryRouter>,
    )
  }

  it('shows BANTAYOG wordmark', async () => {
    await renderSplash()
    expect(screen.getByText('BANTAYOG')).toBeInTheDocument()
  })

  it('calls onDone after 2.5s', async () => {
    await renderSplash()
    expect(navigateSpy).not.toHaveBeenCalled()
    await act(() => vi.advanceTimersByTime(2500))
    expect(navigateSpy).toHaveBeenCalledOnce()
  })

  it('lets urgent users start a report without waiting for the animation', async () => {
    await renderSplash()
    fireEvent.click(screen.getByRole('button', { name: 'Report emergency now' }))
    expect(reportNowSpy).toHaveBeenCalledOnce()
    expect(navigateSpy).not.toHaveBeenCalled()
  })
})

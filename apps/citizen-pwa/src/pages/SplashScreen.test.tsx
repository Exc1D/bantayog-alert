import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// navigate spy — must be hoisted
const navigateSpy = vi.hoisted(() => vi.fn())
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
})
afterEach(() => {
  vi.useRealTimers()
})

describe('SplashScreen', () => {
  async function renderSplash() {
    const { SplashScreen } = await import('./SplashScreen.js')
    return render(
      <MemoryRouter>
        <SplashScreen onDone={navigateSpy} />
      </MemoryRouter>,
    )
  }

  it('shows BANTAYOG wordmark', async () => {
    await renderSplash()
    expect(screen.getByText('BANTAYOG')).toBeInTheDocument()
  })

  it('calls onDone after 1.6s', async () => {
    await renderSplash()
    expect(navigateSpy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1600)
    expect(navigateSpy).toHaveBeenCalledOnce()
  })
})

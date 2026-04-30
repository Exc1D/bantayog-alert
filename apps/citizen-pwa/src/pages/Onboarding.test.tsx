import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const navigateSpy = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async (importActual) => {
  const actual = await importActual<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => navigateSpy }
})

const setDoneSpy = vi.hoisted(() => vi.fn())
vi.mock('../lib/store.js', () => ({
  useUIStore: (
    sel: (s: {
      hasCompletedOnboarding: boolean
      setHasCompletedOnboarding: typeof setDoneSpy
    }) => unknown,
  ) => sel({ hasCompletedOnboarding: false, setHasCompletedOnboarding: setDoneSpy }),
}))

async function renderOnboarding() {
  const { Onboarding } = await import('./Onboarding.js')
  return render(
    <MemoryRouter>
      <Onboarding />
    </MemoryRouter>,
  )
}

describe('Onboarding', () => {
  it('renders step 0 — Welcome', async () => {
    await renderOnboarding()
    expect(screen.getByText(/welcome to bantayog/i)).toBeInTheDocument()
  })

  it('cannot advance from step 1 without consent', async () => {
    await renderOnboarding()
    fireEvent.click(screen.getByRole('button', { name: /get started/i }))
    expect(screen.getByText(/your privacy matters/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    // still on step 1
    expect(screen.getByText(/your privacy matters/i)).toBeInTheDocument()
  })

  it('completes onboarding and navigates to /', async () => {
    await renderOnboarding()
    // Step 0 → 1
    fireEvent.click(screen.getByRole('button', { name: /get started/i }))
    // Give consent
    fireEvent.click(screen.getByRole('checkbox', { name: /agree/i }))
    // Step 1 → 2
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.getByText(/three steps/i)).toBeInTheDocument()
    // Step 2 → done
    fireEvent.click(screen.getByRole('button', { name: /start reporting/i }))
    expect(setDoneSpy).toHaveBeenCalledWith(true)
    expect(navigateSpy).toHaveBeenCalledWith('/', { replace: true })
  })
})

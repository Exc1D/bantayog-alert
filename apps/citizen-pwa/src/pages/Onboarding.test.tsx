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

const promptInstallSpy = vi.hoisted(() => vi.fn())
const dismissInstallPromptSpy = vi.hoisted(() => vi.fn())
vi.mock('../hooks/useInstallPrompt.js', () => ({
  useInstallPrompt: () => ({
    canInstall: true,
    platform: 'chromium',
    promptInstall: promptInstallSpy,
    dismissInstallPrompt: dismissInstallPromptSpy,
    isInstalled: false,
  }),
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
  beforeEach(() => {
    vi.clearAllMocks()
    promptInstallSpy.mockResolvedValue(undefined)
  })

  it('renders step 0 — Welcome', async () => {
    await renderOnboarding()
    expect(screen.getByText(/welcome to bantayog/i)).toBeInTheDocument()
  })

  it('completes onboarding and navigates to /', async () => {
    await renderOnboarding()
    // Step 0 → 1
    fireEvent.click(screen.getByRole('button', { name: /get started/i }))
    expect(screen.getByText(/three steps/i)).toBeInTheDocument()
    // Step 1 → done
    fireEvent.click(screen.getByRole('button', { name: /start reporting/i }))
    expect(setDoneSpy).toHaveBeenCalledWith(true)
    expect(navigateSpy).toHaveBeenCalledWith('/', { replace: true })
  })

  it('renders install prompt panel on step 1 and buttons call handlers', async () => {
    await renderOnboarding()

    // Advance to step 1
    fireEvent.click(screen.getByRole('button', { name: /get started/i }))

    // Install panel should be visible
    expect(screen.getByText(/install bantayog for faster access/i)).toBeInTheDocument()

    // Click Install button
    fireEvent.click(screen.getByRole('button', { name: /install/i }))
    expect(promptInstallSpy).toHaveBeenCalledOnce()

    // Click Not now button
    fireEvent.click(screen.getByRole('button', { name: /not now/i }))
    expect(dismissInstallPromptSpy).toHaveBeenCalledOnce()
  })
})

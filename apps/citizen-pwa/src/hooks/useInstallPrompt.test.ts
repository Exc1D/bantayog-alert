import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useInstallPrompt } from './useInstallPrompt.js'

const originalMatchMedia = window.matchMedia

function setStandaloneDisplayMode(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(display-mode: standalone)' ? matches : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

function createInstallPromptEvent(outcome: 'accepted' | 'dismissed' = 'accepted'): {
  event: BeforeInstallPromptEvent
  prompt: ReturnType<typeof vi.fn>
} {
  const prompt = vi.fn().mockResolvedValue(undefined)
  const event = new Event('beforeinstallprompt', {
    cancelable: true,
  }) as BeforeInstallPromptEvent

  Object.defineProperties(event, {
    platforms: { value: ['web'] },
    prompt: { value: prompt },
    userChoice: {
      value: Promise.resolve({ outcome, platform: 'web' }),
    },
  })

  return { event, prompt }
}

describe('useInstallPrompt', () => {
  beforeEach(() => {
    localStorage.clear()
    window.deferredInstallPrompt = null
    setStandaloneDisplayMode(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: originalMatchMedia,
    })
  })

  it('captures beforeinstallprompt and prompts from a user action', async () => {
    const { result } = renderHook(() => useInstallPrompt({ surface: 'onboarding' }))
    const { event, prompt } = createInstallPromptEvent()

    act(() => {
      window.dispatchEvent(event)
    })

    await waitFor(() => {
      expect(result.current.canInstall).toBe(true)
    })
    expect(result.current.platform).toBe('chromium')

    await act(async () => {
      await result.current.promptInstall()
    })

    expect(prompt).toHaveBeenCalledOnce()
    expect(window.deferredInstallPrompt).toBeNull()
  })

  it('hides the prompt when the app is already running standalone', () => {
    setStandaloneDisplayMode(true)

    const { result } = renderHook(() => useInstallPrompt({ surface: 'onboarding' }))

    expect(result.current.isInstalled).toBe(true)
    expect(result.current.canInstall).toBe(false)
  })

  it('persists dismissal per surface', async () => {
    const { result, unmount } = renderHook(() => useInstallPrompt({ surface: 'onboarding' }))
    const { event } = createInstallPromptEvent('dismissed')

    act(() => {
      window.dispatchEvent(event)
    })

    await waitFor(() => {
      expect(result.current.canInstall).toBe(true)
    })

    act(() => {
      result.current.dismissInstallPrompt()
    })

    expect(result.current.canInstall).toBe(false)
    unmount()

    const { result: secondResult } = renderHook(() => useInstallPrompt({ surface: 'onboarding' }))

    expect(secondResult.current.canInstall).toBe(false)
  })
})

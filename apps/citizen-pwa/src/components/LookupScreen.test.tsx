import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
const { mockLoadReports, mockHttpsCallable, mockUseOnlineStatus } = vi.hoisted(() => ({
  mockLoadReports: vi.fn(),
  mockHttpsCallable: vi.fn(),
  mockUseOnlineStatus: vi.fn(),
}))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../services/localForageReports.js', () => ({
  loadReports: mockLoadReports,
}))

vi.mock('../services/firebase.js', () => ({
  fns: () => ({}),
  hasFirebaseConfig: () => true,
  ensureSignedIn: () => Promise.resolve(),
  FIREBASE_ENV_ERROR_MESSAGE: 'Firebase not configured',
}))

vi.mock('../hooks/useOnlineStatus.js', () => ({
  useOnlineStatus: () => mockUseOnlineStatus(),
}))

let callableSecret = ''
vi.mock('firebase/functions', () => ({
  httpsCallable: mockHttpsCallable,
}))

mockHttpsCallable.mockImplementation(() => async (_data: unknown) => {
  callableSecret = (_data as { secret?: string }).secret ?? ''
  if (!callableSecret.trim()) {
    return Promise.resolve({
      data: {
        publicRef: 'a1b2c3d4',
        status: 'new',
        lastStatusAt: Date.now(),
        municipalityLabel: 'Daet',
      },
    })
  }
  return Promise.resolve({
    data: {
      publicRef: 'a1b2c3d4',
      status: 'new',
      lastStatusAt: Date.now(),
      municipalityLabel: 'Daet',
    },
  })
})

import { LookupScreen } from './LookupScreen'

function renderScreen() {
  return render(
    <MemoryRouter>
      <LookupScreen />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockNavigate.mockReset()
  mockLoadReports.mockReset().mockResolvedValue([])
  mockHttpsCallable.mockClear()
  mockUseOnlineStatus.mockReturnValue({ isOnline: true, navigatorOnline: true })
})

describe('LookupScreen', () => {
  it('renders a single secret code input', () => {
    renderScreen()
    expect(screen.getByPlaceholderText('Your secret code')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('BA-2026-XXXXX')).not.toBeInTheDocument()
  })

  it('renders the Find My Report submit button', () => {
    renderScreen()
    expect(screen.getByRole('button', { name: /find my report/i })).toBeInTheDocument()
  })

  it('shows teal header with Track your Report heading', () => {
    renderScreen()
    expect(screen.getByText('Track your Report')).toBeInTheDocument()
  })

  it('shows validation error when submitted with whitespace-only input', async () => {
    const user = userEvent.setup()
    renderScreen()
    const input = screen.getByPlaceholderText('Your secret code')
    await user.type(input, '   ')
    await user.click(screen.getByRole('button', { name: /find my report/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })

  it('navigates to the selected report on successful lookup', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.type(screen.getByPlaceholderText('Your secret code'), 'mysecretcode')
    await user.click(screen.getByRole('button', { name: /find my report/i }))
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/', {
        state: {
          selectedReportPublicRef: 'a1b2c3d4',
          lookupSuccessMessage: 'Report found — tracking enabled',
        },
      })
    })
    expect(callableSecret).toBe('MYSECRETCODE')
  })

  it('shows friendly error when lookup returns not-found', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mockHttpsCallable.mockImplementationOnce(() => () => {
      const err = new Error('not-found')
      ;(err as unknown as { code: string }).code = 'functions/not-found'
      return Promise.reject(err)
    })
    try {
      const user = userEvent.setup()
      renderScreen()
      await user.type(screen.getByPlaceholderText('Your secret code'), 'badsecret')
      await user.click(screen.getByRole('button', { name: /find my report/i }))
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/couldn't find/)
      })
    } finally {
      consoleError.mockRestore()
    }
  })

  it('shows offline copy and preserves the entered code without remote lookup while offline', async () => {
    mockUseOnlineStatus.mockReturnValue({ isOnline: false, navigatorOnline: false })

    const user = userEvent.setup()
    renderScreen()
    const input = screen.getByPlaceholderText('Your secret code')
    await user.type(input, 'stillvalid')
    await user.click(screen.getByRole('button', { name: /find my report/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/you're offline/i)
    })
    expect(input).toHaveValue('stillvalid')
    expect(mockHttpsCallable).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('shows offline copy when isOnline is false even if navigatorOnline is true', async () => {
    mockUseOnlineStatus.mockReturnValue({ isOnline: false, navigatorOnline: true })

    const user = userEvent.setup()
    renderScreen()
    const input = screen.getByPlaceholderText('Your secret code')
    await user.type(input, 'partial')
    await user.click(screen.getByRole('button', { name: /find my report/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/you're offline/i)
    })
    expect(input).toHaveValue('partial')
    expect(mockHttpsCallable).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('shows offline retry copy when the lookup callable is unavailable', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mockHttpsCallable.mockImplementationOnce(() => () => {
      const err = new Error('unavailable')
      ;(err as unknown as { code: string }).code = 'functions/unavailable'
      return Promise.reject(err)
    })
    try {
      const user = userEvent.setup()
      renderScreen()
      const input = screen.getByPlaceholderText('Your secret code')
      await user.type(input, 'networksecret')
      await user.click(screen.getByRole('button', { name: /find my report/i }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/you're offline/i)
      })
      expect(input).toHaveValue('networksecret')
      expect(mockNavigate).not.toHaveBeenCalled()
    } finally {
      consoleError.mockRestore()
    }
  })

  it('shows generic error for a non-network TypeError', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mockHttpsCallable.mockImplementationOnce(() => () => {
      const err = new TypeError('undefined is not a function')
      return Promise.reject(err)
    })
    try {
      const user = userEvent.setup()
      renderScreen()
      await user.type(screen.getByPlaceholderText('Your secret code'), 'typo')
      await user.click(screen.getByRole('button', { name: /find my report/i }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/something went wrong/i)
      })
    } finally {
      consoleError.mockRestore()
    }
  })

  it('navigates to locally saved report when a local match exists', async () => {
    mockLoadReports.mockResolvedValue([
      {
        publicRef: 'loc12345',
        secret: 'LOCALSECRET',
        reportType: 'flood',
        severity: 'high',
        lat: 14.1,
        lng: 122.9,
        submittedAt: 1713350400000,
      },
    ])

    const user = userEvent.setup()
    renderScreen()
    await user.type(screen.getByPlaceholderText('Your secret code'), 'localsecret')
    await user.click(screen.getByRole('button', { name: /find my report/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/', {
        state: {
          selectedReportPublicRef: 'loc12345',
          lookupSuccessMessage: 'Report found — tracking enabled',
        },
      })
    })
    expect(mockHttpsCallable).not.toHaveBeenCalled()
  })
})

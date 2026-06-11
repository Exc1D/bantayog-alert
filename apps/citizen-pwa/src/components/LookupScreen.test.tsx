import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
const { mockLoadReports } = vi.hoisted(() => ({
  mockLoadReports: vi.fn(),
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

let callableSecret = ''
vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn().mockImplementation(() => async (_data: unknown) => {
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
  }) as unknown as import('firebase/functions').HttpsCallable<unknown, unknown>,
}))

import { LookupScreen } from './LookupScreen'
import { httpsCallable } from 'firebase/functions'

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
  vi.mocked(httpsCallable).mockClear()
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
    vi.mocked(httpsCallable).mockImplementationOnce(
      () =>
        (() => {
          const err = new Error('not-found')
          ;(err as unknown as { code: string }).code = 'functions/not-found'
          return Promise.reject(err)
        }) as unknown as import('firebase/functions').HttpsCallable<unknown, unknown>,
    )
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
    expect(vi.mocked(httpsCallable)).not.toHaveBeenCalled()
  })
})

import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { RevealSheet } from './RevealSheet'

const { mockHasFirebaseConfig, mockNavigate, mockOnAuthStateChanged, mockRequestPermission } =
  vi.hoisted(() => ({
    mockHasFirebaseConfig: vi.fn(),
    mockNavigate: vi.fn(),
    mockOnAuthStateChanged: vi.fn(),
    mockRequestPermission: vi.fn(),
  }))

vi.mock('../services/firebase.js', () => ({
  auth: vi.fn(),
  hasFirebaseConfig: mockHasFirebaseConfig,
}))

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: mockOnAuthStateChanged,
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('../hooks/useFcmToken.js', () => ({
  useFcmToken: () => ({
    permission: 'default',
    token: null,
    enabled: false,
    requestPermission: mockRequestPermission,
    disable: vi.fn(),
  }),
}))

vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}))

vi.mock('./ui/StatusBanner', () => ({
  StatusBanner: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('./ui/Button', () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}))

vi.mock('./ui/FallbackCards', () => ({
  FallbackCards: () => <div>Fallback</div>,
}))

vi.mock('./ui/Timeline', () => ({
  Timeline: () => <div>Timeline</div>,
}))

function setNotificationPermission(permission: NotificationPermission): void {
  Object.defineProperty(globalThis, 'Notification', {
    value: { permission },
    configurable: true,
  })
}

async function flushEffects(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
  })
}

function setupRegisteredUser(permissionValue: boolean | Error = true): void {
  mockHasFirebaseConfig.mockReturnValue(true)
  mockOnAuthStateChanged.mockImplementation((_auth: unknown, cb: (user: unknown) => void) => {
    cb({ uid: 'registered-user', isAnonymous: false })
    return () => undefined
  })
  if (permissionValue === true) {
    mockRequestPermission.mockResolvedValue(true)
  } else if (permissionValue === false) {
    mockRequestPermission.mockResolvedValue(false)
  } else {
    mockRequestPermission.mockRejectedValue(permissionValue)
  }
}

describe('RevealSheet', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockOnAuthStateChanged.mockReset()
    mockHasFirebaseConfig.mockReturnValue(false)
    mockRequestPermission.mockResolvedValue(true)
    setNotificationPermission('default')
    Object.defineProperty(navigator, 'vibrate', {
      writable: true,
      value: vi.fn(() => true),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders secret code section after typewriter', async () => {
    render(<RevealSheet state="success" referenceCode="BA-2026-001" secretCode="SECRET123" />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200)
    })
    expect(screen.getByText('Secret Code')).toBeInTheDocument()
    expect(screen.getByText('SHOWN ONCE')).toBeInTheDocument()
    expect(screen.getByText('SECRET123')).toBeInTheDocument()
  })

  it('does not show secret code section without secretCode', async () => {
    render(<RevealSheet state="success" referenceCode="BA-2026-001" />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200)
    })
    expect(screen.queryByText('Secret Code')).not.toBeInTheDocument()
  })

  it('calls navigator.vibrate with correct pattern on success mount', () => {
    render(<RevealSheet state="success" referenceCode="BA-2026-001" />)
    expect(navigator.vibrate).toHaveBeenCalledWith([15, 80, 25])
  })

  it('shows afterglow footer on success after typewriter', async () => {
    render(<RevealSheet state="success" referenceCode="BA-2026-001" />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200)
    })
    expect(screen.getByText(/Daet MDRRMO is on it/)).toBeInTheDocument()
  })

  it('shows notification registration nudge for unregistered users on success', async () => {
    render(<RevealSheet state="success" referenceCode="BA-2026-001" />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200)
    })
    expect(
      screen.getByText('Create an account to get notified when help is on the way'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Create Account/)).toBeInTheDocument()
  })

  it('offers registered users help-on-the-way notifications on success', async () => {
    setupRegisteredUser(true)

    render(<RevealSheet state="success" referenceCode="BA-2026-001" />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200)
    })
    await flushEffects()

    expect(screen.getByText('Get notified when help is on the way')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Get report status updates and public emergency alerts from Bantayog Alert.',
      ),
    ).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /get notified/i }))
      await Promise.resolve()
    })

    expect(mockRequestPermission).toHaveBeenCalledOnce()
    expect(screen.queryByText('Get notified when help is on the way')).not.toBeInTheDocument()
  })

  it('dismisses the registered notification offer without requesting permission', async () => {
    setupRegisteredUser(true)

    render(<RevealSheet state="success" referenceCode="BA-2026-001" />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200)
    })
    await flushEffects()

    fireEvent.click(screen.getByRole('button', { name: /not now/i }))

    expect(screen.queryByText('Get notified when help is on the way')).not.toBeInTheDocument()
    expect(mockRequestPermission).not.toHaveBeenCalled()
  })

  async function clickNotifyAndAssertError(): Promise<void> {
    render(<RevealSheet state="success" referenceCode="BA-2026-001" />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200)
    })
    await flushEffects()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /get notified/i }))
      await Promise.resolve()
    })

    expect(screen.getByText(/Could not enable notifications/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  }

  it('shows error state when permission request returns false', async () => {
    setupRegisteredUser(false)
    await clickNotifyAndAssertError()
  })

  it('shows error state when permission request throws', async () => {
    setupRegisteredUser(new Error('FCM setup failed'))
    await clickNotifyAndAssertError()
  })

  it('nudges anonymous users to register for help-on-the-way notifications', async () => {
    mockHasFirebaseConfig.mockReturnValue(true)
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, cb: (user: unknown) => void) => {
      cb({ uid: 'anon-user', isAnonymous: true })
      return () => undefined
    })

    render(<RevealSheet state="success" referenceCode="BA-2026-001" />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200)
    })
    await flushEffects()

    expect(
      screen.getByText('Create an account to get notified when help is on the way'),
    ).toBeInTheDocument()

    expect(screen.queryByRole('button', { name: /get notified/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(mockRequestPermission).not.toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith('/register')
  })

  it('does not ask for notifications after browser permission is decided', async () => {
    setupRegisteredUser(true)
    setNotificationPermission('denied')

    render(<RevealSheet state="success" referenceCode="BA-2026-001" />)
    await flushEffects()

    expect(screen.queryByText('Get notified when help is on the way')).not.toBeInTheDocument()
  })
})

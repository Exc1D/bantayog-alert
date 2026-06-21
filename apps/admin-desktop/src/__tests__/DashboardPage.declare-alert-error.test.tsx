import { beforeEach, describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import DashboardPage from '../pages/DashboardPage'
import {
  renderWithMemoryRouter,
  defaultRows,
  defaultResponders,
  defaultMetrics,
} from '../test-utils'

const mockNavigate = vi.fn()

vi.mock('../app/firebase', () => ({
  db: {} as never,
  getFirestoreInstance: () => ({}) as never,
  auth: {} as never,
  functions: {} as never,
  rtdb: {} as never,
  firebaseApp: {} as never,
}))

vi.mock('../providers/WindowSyncProvider', async () =>
  (await import('../test-utils')).createWindowSyncProviderModuleMock(),
)

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('@bantayog/shared-ui', () => ({
  useAuth: () => ({
    signOut: vi.fn(),
    loading: false,
    claims: { role: 'provincial_superadmin' },
  }),
}))

vi.mock('../services/callables', () => ({
  callables: {
    verifyReport: vi.fn(),
    redispatchReport: vi.fn(),
  },
}))

vi.mock('../hooks/useDispatchLifecycle', () => ({
  useDispatchLifecycle: () => ({
    rows: defaultRows,
    loading: false,
    error: null,
  }),
}))

vi.mock('../hooks/useResponderFleet', () => ({
  useResponderFleet: () => ({
    responders: defaultResponders,
    loading: false,
    error: null,
  }),
}))

vi.mock('../hooks/useOpsMetrics', () => ({
  useOpsMetrics: () => defaultMetrics,
}))

vi.mock('../hooks/useFirestoreListeners', () => ({
  useFirestoreListeners: () => ({
    reports: [],
    loading: false,
    error: null,
    alerts: [],
  }),
}))

vi.mock('../components/DeclareAlertModal', () => ({
  DeclareAlertModal: ({ open, onError }: { open: boolean; onError: (message: string) => void }) =>
    open ? (
      <button
        type="button"
        onClick={() => {
          onError('Alert broadcast failed')
        }}
      >
        force-alert-error
      </button>
    ) : null,
}))

describe('DashboardPage declare-alert error surfacing (3c-20)', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
  })

  it('surfaces the error message in ActionErrorBanner when alert declaration fails', async () => {
    renderWithMemoryRouter(<DashboardPage />)

    // Open the alert modal via the CommandHeader "Declare Alert" button
    fireEvent.click(screen.getByRole('button', { name: /declare alert/i }))

    // Trigger the error via the mock modal's button
    fireEvent.click(screen.getByText('force-alert-error'))

    // The banner should surface the error message
    expect(await screen.findByText('Alert broadcast failed')).toBeInTheDocument()
  })
})

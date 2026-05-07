/// <reference types="node" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TestWrapper } from './test-utils'

// Hoist mocks so they can be referenced by vi.mock factories
const mockLoad = vi.hoisted(() => vi.fn())
const mockClear = vi.hoisted(() => vi.fn())

vi.mock('../services/wizard-snapshot', () => ({
  wizardSnapshot: {
    load: mockLoad,
    save: vi.fn().mockResolvedValue(undefined),
    clear: mockClear,
  },
}))

vi.mock('../services/firebase', () => ({
  auth: vi.fn(() => ({ currentUser: null })),
  db: {},
  fns: {},
  hasFirebaseConfig: vi.fn(() => false),
}))

vi.mock('../hooks/useAlerts', () => ({
  useAlerts: () => ({ alerts: [] }),
}))

vi.mock('../hooks/useAlertReadState', () => ({
  useAlertReadState: () => ({ unreadCount: () => 0 }),
}))

vi.mock('../hooks/useOfflineQueueCount', () => ({
  useOfflineQueueCount: () => ({ isOnline: true, queueCount: 0 }),
}))

vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}))

vi.mock('../components/ReportStatusPill', () => ({
  ReportStatusPill: () => null,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useLocation: () => ({ pathname: '/' }),
    useNavigate: () => vi.fn(),
  }
})

vi.mock('../styles/design-tokens.css', () => ({}))

async function renderShell(pathname = '/') {
  vi.doMock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom')
    return {
      ...actual,
      useLocation: () => ({ pathname }),
      useNavigate: () => vi.fn(),
    }
  })
  const { CitizenShell } = await import('../components/CitizenShell')
  return render(
    <TestWrapper>
      <CitizenShell>
        <div>child content</div>
      </CitizenShell>
    </TestWrapper>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockClear.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CitizenShell — draft resume prompt', () => {
  it('shows the resume banner when a valid snapshot exists', async () => {
    mockLoad.mockResolvedValue({
      step: 2,
      step1: { reportType: 'flood' },
      step2: null,
      updatedAt: Date.now(),
    })
    await renderShell('/')
    await waitFor(() => {
      expect(screen.getByText(/unfinished report/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/hindi pa natapos/i)).toBeInTheDocument()
  })

  it('does NOT show banner when no snapshot exists', async () => {
    mockLoad.mockResolvedValue(null)
    await renderShell('/')
    await waitFor(() => {
      expect(screen.queryByText(/unfinished report/i)).not.toBeInTheDocument()
    })
  })

  it('does NOT show banner when already on /report route', async () => {
    mockLoad.mockResolvedValue({
      step: 1,
      step1: { reportType: 'flood' },
      step2: null,
      updatedAt: Date.now(),
    })
    await renderShell('/report')
    await waitFor(() => {
      expect(screen.queryByText(/unfinished report/i)).not.toBeInTheDocument()
    })
  })

  it('Discard button clears snapshot and hides banner', async () => {
    mockLoad.mockResolvedValue({
      step: 1,
      step1: { reportType: 'fire' },
      step2: null,
      updatedAt: Date.now(),
    })
    await renderShell('/')

    await waitFor(() => {
      expect(screen.getByText(/unfinished report/i)).toBeInTheDocument()
    })

    const discardBtn = screen.getByRole('button', { name: /discard/i })
    await userEvent.click(discardBtn)

    expect(mockClear).toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.queryByText(/unfinished report/i)).not.toBeInTheDocument()
    })
  })

  it('banner has role="status" for screen reader announcement', async () => {
    mockLoad.mockResolvedValue({
      step: 1,
      step1: { reportType: 'flood' },
      step2: null,
      updatedAt: Date.now(),
    })
    await renderShell('/')
    await waitFor(() => {
      const banner = screen.getByRole('status', { name: /draft/i })
      expect(banner).toBeInTheDocument()
    })
  })
})

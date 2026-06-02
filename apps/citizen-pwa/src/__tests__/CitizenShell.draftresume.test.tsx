/// <reference types="node" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TestWrapper } from './test-utils'

// Hoist mocks so they can be referenced by vi.mock factories
const mockLoad = vi.hoisted(() => vi.fn())
const mockClear = vi.hoisted(() => vi.fn())
const mockPathname = vi.hoisted(() => ({ value: '/' }))

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
    useLocation: () => ({ pathname: mockPathname.value }),
    useNavigate: () => vi.fn(),
  }
})

vi.mock('../styles/design-tokens.css', () => ({}))

async function renderShell(pathname = '/') {
  mockPathname.value = pathname
  const { CitizenShell } = await import('../components/CitizenShell')
  let result: ReturnType<typeof render> | undefined
  await act(async () => {
    result = render(
      <TestWrapper>
        <CitizenShell>
          <div>child content</div>
        </CitizenShell>
      </TestWrapper>,
    )
    await Promise.resolve()
  })
  if (!result) throw new Error('CitizenShell did not render')
  return result
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

  it('asks for confirmation before discarding a saved report', async () => {
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

    expect(mockClear).not.toHaveBeenCalled()
    expect(screen.getByText(/discard this unfinished report/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /discard report/i }))

    expect(mockClear).toHaveBeenCalledOnce()
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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('../app/firebase', () => ({ db: {} }))
vi.mock('@bantayog/shared-ui', () => ({
  useAuth: () => ({
    claims: { municipalityId: 'daet', role: 'municipal_admin' },
    signOut: vi.fn(),
  }),
}))

const { mockGetCountFromServer, mockGetDocs, mockGetDoc, mockDoc, mockWhere } = vi.hoisted(() => ({
  mockGetCountFromServer: vi.fn(),
  mockGetDocs: vi.fn(),
  mockGetDoc: vi.fn(),
  mockDoc: vi.fn(() => ({})),
  mockWhere: vi.fn(() => ({})),
}))

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  getCountFromServer: mockGetCountFromServer,
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: mockWhere,
  orderBy: vi.fn(() => ({})),
  limit: vi.fn(() => ({})),
  getDocs: mockGetDocs,
  getDoc: mockGetDoc,
  doc: mockDoc,
}))

import { AnalyticsDashboardPage } from '../pages/AnalyticsDashboardPage'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('AnalyticsDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCountFromServer.mockResolvedValue({ data: () => ({ count: 42 }) })
    mockGetDocs.mockResolvedValue({ docs: [] })
    mockGetDoc.mockResolvedValue({ exists: () => false })
    mockWhere.mockReturnValue({})
  })

  it('renders the live active-incidents count', async () => {
    render(<AnalyticsDashboardPage />, { wrapper })
    expect(await screen.findByText('42')).toBeInTheDocument()
  })

  it('shows a loading state while analytics count is fetching', () => {
    mockGetCountFromServer.mockImplementationOnce(
      () =>
        new Promise<void>(() => {
          /* never resolves */
        }),
    )
    render(<AnalyticsDashboardPage />, { wrapper })
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows trend loading state while snapshot data is fetching', async () => {
    mockGetDocs.mockImplementationOnce(
      () =>
        new Promise(() => {
          /* never resolves */
        }),
    )
    render(<AnalyticsDashboardPage />, { wrapper })
    expect(await screen.findByText('Loading trend…')).toBeInTheDocument()
  })

  it("scopes data to the caller's municipalityId for muni admins", async () => {
    render(<AnalyticsDashboardPage />, { wrapper })
    expect(await screen.findByText(/daet/i)).toBeInTheDocument()
    // Verify the live-count query included the municipalityId filter.
    const hasMuniFilter = (mockWhere.mock.calls as unknown[][]).some(
      (args) => args[0] === 'municipalityId' && args[1] === '==' && args[2] === 'daet',
    )
    expect(hasMuniFilter).toBe(true)
  })

  it('renders a trend chart when snapshots are present', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          id: '2026-04-20',
          data: () => ({
            reportsByStatus: { verified: 5, closed: 2 },
          }),
        },
      ],
    })
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ reportsByStatus: { verified: 5, closed: 2 } }),
    })
    render(<AnalyticsDashboardPage />, { wrapper })
    expect(await screen.findByLabelText('7-day trend chart')).toBeInTheDocument()
    expect(screen.getByLabelText(/2026-04-20: 7 reports/)).toBeInTheDocument()
  })
})

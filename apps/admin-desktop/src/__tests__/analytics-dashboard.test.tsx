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

const { mockGetCountFromServer, mockGetDocs, mockWhere } = vi.hoisted(() => ({
  mockGetCountFromServer: vi.fn(),
  mockGetDocs: vi.fn(),
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
}))

import { AnalyticsDashboardPage } from '../pages/AnalyticsDashboardPage'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('AnalyticsDashboardPage', () => {
  beforeEach(() => {
    mockGetCountFromServer.mockResolvedValue({ data: () => ({ count: 42 }) })
    mockGetDocs.mockResolvedValue({ docs: [] })
    mockWhere.mockReturnValue({})
  })

  it('renders the live active-incidents count', async () => {
    render(<AnalyticsDashboardPage />, { wrapper })
    expect(await screen.findByText('42')).toBeInTheDocument()
  })

  it('shows a loading state while snapshot data is fetching', () => {
    mockGetCountFromServer.mockImplementationOnce(
      () =>
        new Promise<void>(() => {
          /* never resolves */
        }),
    )
    render(<AnalyticsDashboardPage />, { wrapper })
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
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
})

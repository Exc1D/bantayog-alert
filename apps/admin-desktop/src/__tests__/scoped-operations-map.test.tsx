import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

interface AuthClaims {
  role: string
  municipalityId?: string
  agencyId?: string
}

const authState = vi.hoisted(() => ({
  claims: { role: 'municipal_admin', municipalityId: 'daet' } satisfies AuthClaims,
}))

const { mockListScopedOperationsMap } = vi.hoisted(() => ({
  mockListScopedOperationsMap: vi.fn(),
}))

vi.mock('@bantayog/shared-ui', () => ({
  useAuth: () => ({
    claims: authState.claims,
    loading: false,
  }),
}))

vi.mock('../services/callables', () => ({
  callables: {
    listScopedOperationsMap: mockListScopedOperationsMap,
  },
}))
vi.mock('@/components/layout/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import ScopedOperationsMapPage from '../pages/ScopedOperationsMapPage'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('ScopedOperationsMapPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.claims = { role: 'municipal_admin', municipalityId: 'daet' }
    mockListScopedOperationsMap.mockResolvedValue({
      incidents: [
        {
          reportId: 'rep-1',
          report: {
            reportType: 'fire',
            severity: 'high',
            status: 'new',
            municipalityLabel: 'Daet',
            barangayId: 'Poblacion',
            description: 'Test incident',
            publicLocation: { lat: 14.11, lng: 122.95 },
            submittedAt: 1713350400000,
            updatedAt: 1713350400000,
          },
        },
      ],
    })
  })

  it('loads municipal map incidents through the scoped callable', async () => {
    render(<ScopedOperationsMapPage />, { wrapper })
    expect(await screen.findByText(/live map · daet/i)).toBeInTheDocument()
    expect(mockListScopedOperationsMap).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(mockListScopedOperationsMap).toHaveBeenCalled()
    })
    expect(await screen.findByText('Test incident')).toBeInTheDocument()
  })

  it('loads agency map incidents through the scoped callable', async () => {
    authState.claims = { role: 'agency_admin', agencyId: 'bfp-daet' }
    mockListScopedOperationsMap.mockResolvedValueOnce({
      incidents: [
        {
          reportId: 'rep-2',
          report: {
            reportType: 'flood',
            severity: 'medium',
            status: 'verified',
            municipalityLabel: 'Mercedes',
            barangayId: 'San Isidro',
            description: 'Agency scoped incident',
            publicLocation: { lat: 14.21, lng: 122.85 },
            submittedAt: 1713350400000,
            updatedAt: 1713350400000,
          },
        },
      ],
    })
    render(<ScopedOperationsMapPage />, { wrapper })
    expect(await screen.findByText(/live map · bfp-daet/i)).toBeInTheDocument()
    expect(mockListScopedOperationsMap).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Agency scoped incident')).toBeInTheDocument()
  })
})

import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { MemoryRouter, useSearchParams } from 'react-router-dom'
import { useUrlSync } from './useUrlSync'

describe('useUrlSync', () => {
  it('reads reportId from URL on mount', async () => {
    const onReportIdChange = vi.fn()

    renderHook(
      () => {
        useUrlSync({ reportId: null, onReportIdChange })
      },
      {
        wrapper: ({ children }) => (
          <MemoryRouter initialEntries={['/map?reportId=r1']}>{children}</MemoryRouter>
        ),
      },
    )

    await waitFor(() => {
      expect(onReportIdChange).toHaveBeenCalledWith('r1')
    })
  })

  it('reads municipalityId from URL on mount', async () => {
    const onMunicipalityIdChange = vi.fn()

    renderHook(
      () => {
        useUrlSync({ municipalityId: null, onMunicipalityIdChange })
      },
      {
        wrapper: ({ children }) => (
          <MemoryRouter initialEntries={['/map?municipalityId=daet']}>{children}</MemoryRouter>
        ),
      },
    )

    await waitFor(() => {
      expect(onMunicipalityIdChange).toHaveBeenCalledWith('daet')
    })
  })

  it('reads overlays from URL on mount', async () => {
    const onOverlaysChange = vi.fn()

    renderHook(
      () => {
        useUrlSync({ overlays: [], onOverlaysChange })
      },
      {
        wrapper: ({ children }) => (
          <MemoryRouter initialEntries={['/map?overlay=heatmap&overlay=clusters']}>
            {children}
          </MemoryRouter>
        ),
      },
    )

    await waitFor(() => {
      expect(onOverlaysChange).toHaveBeenCalledWith(['heatmap', 'clusters'])
    })
  })

  it('does not call setter when URL already matches state', () => {
    const onReportIdChange = vi.fn()

    renderHook(
      () => {
        useUrlSync({ reportId: 'r1', onReportIdChange })
      },
      {
        wrapper: ({ children }) => (
          <MemoryRouter initialEntries={['/map?reportId=r1']}>{children}</MemoryRouter>
        ),
      },
    )

    expect(onReportIdChange).not.toHaveBeenCalled()
  })

  it('writes state to URL', async () => {
    function Wrapper({ children }: { children: React.ReactNode }) {
      return <MemoryRouter initialEntries={['/map']}>{children}</MemoryRouter>
    }

    const { result } = renderHook(
      () => {
        const [searchParams] = useSearchParams()
        useUrlSync({ reportId: 'r2' })
        return { searchParams }
      },
      { wrapper: Wrapper },
    )

    await waitFor(() => {
      expect(result.current.searchParams.get('reportId')).toBe('r2')
    })
  })

  it('clears param from URL when state becomes null', async () => {
    function Wrapper({ children }: { children: React.ReactNode }) {
      return <MemoryRouter initialEntries={['/map?reportId=r3']}>{children}</MemoryRouter>
    }

    const { result } = renderHook(
      () => {
        const [searchParams] = useSearchParams()
        useUrlSync({ reportId: null })
        return { searchParams }
      },
      { wrapper: Wrapper },
    )

    await waitFor(() => {
      expect(result.current.searchParams.get('reportId')).toBeNull()
    })
  })
})

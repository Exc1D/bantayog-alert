import { act, fireEvent, render as renderWithTestingLibrary, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DetailSheet } from './DetailSheet.js'

const publicProps = {
  mode: 'public' as const,
  incident: {
    id: 'incident-123',
    reportType: 'flood' as const,
    severity: 'high' as const,
    status: 'verified' as const,
    barangayId: 'brgy-1',
    municipalityLabel: 'Daet',
    publicLocation: { lat: 14.1, lng: 122.9 },
    submittedAt: Date.now() - 720_000,
  },
}

const myReportProps = {
  mode: 'myReport' as const,
  report: {
    id: 'report-id-5678',
    publicRef: 'abcd1234',
    reportType: 'flood' as const,
    severity: 'high' as const,
    lat: 14.1,
    lng: 122.9,
    submittedAt: Date.now() - 720_000,
    status: 'new' as const,
    municipalityLabel: 'Daet',
  },
}

function renderSheet(element: ReactElement) {
  return renderWithTestingLibrary(<MemoryRouter>{element}</MemoryRouter>)
}

beforeEach(() => {
  vi.useRealTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('DetailSheet public-incident peek', () => {
  it('renders null when hidden', () => {
    const { container } = renderSheet(
      <DetailSheet sheetPhase="hidden" onClose={vi.fn()} onCollapse={vi.fn()} {...publicProps} />,
    )

    expect(container.firstChild).toBeNull()
  })

  it('keeps the public incident summary and links to its detail route', () => {
    renderSheet(
      <DetailSheet sheetPhase="expanded" onClose={vi.fn()} onCollapse={vi.fn()} {...publicProps} />,
    )

    expect(screen.getByText('Flood')).toBeInTheDocument()
    expect(screen.getByText('HIGH')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View incident details' })).toHaveAttribute(
      'href',
      '/incidents/incident-123',
    )
  })

  it('calls onClose when Close is clicked', () => {
    const onClose = vi.fn()
    renderSheet(
      <DetailSheet sheetPhase="expanded" onClose={onClose} onCollapse={vi.fn()} {...publicProps} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('DetailSheet own-report peek', () => {
  it('shows registry status, tracking code, and the full-response route', () => {
    renderSheet(
      <DetailSheet
        sheetPhase="expanded"
        onClose={vi.fn()}
        onCollapse={vi.fn()}
        {...myReportProps}
      />,
    )

    expect(screen.getByText('Received')).toBeInTheDocument()
    expect(screen.getByText('abcd1234')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View full response' })).toHaveAttribute(
      'href',
      '/track/abcd1234',
    )
  })

  it('does not duplicate the full tracking timeline inside the peek', () => {
    renderSheet(
      <DetailSheet
        sheetPhase="expanded"
        onClose={vi.fn()}
        onCollapse={vi.fn()}
        mode="myReport"
        report={{
          ...myReportProps.report,
          status: 'en_route',
          lastStatusAt: Date.now() - 600_000,
        }}
      />,
    )

    expect(screen.queryByRole('heading', { name: 'Tracking timeline' })).not.toBeInTheDocument()
    expect(screen.queryByText('First review')).not.toBeInTheDocument()
  })

  it('copies the tracking code and resets its label after two seconds', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    renderSheet(
      <DetailSheet
        sheetPhase="expanded"
        onClose={vi.fn()}
        onCollapse={vi.fn()}
        {...myReportProps}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
      await Promise.resolve()
    })
    expect(writeText).toHaveBeenCalledWith('abcd1234')
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument()
  })
})

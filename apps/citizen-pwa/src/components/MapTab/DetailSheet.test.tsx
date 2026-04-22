import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { DetailSheet } from './DetailSheet.js'

const publicProps = {
  mode: 'public' as const,
  incident: {
    id: 'i1',
    reportType: 'flood' as const,
    severity: 'high' as const,
    status: 'verified' as const,
    barangayId: 'brgy-1',
    municipalityLabel: 'Daet',
    publicLocation: { lat: 14.1, lng: 122.9 },
    submittedAt: Date.now() - 720000,
  },
}

const myReportProps = {
  mode: 'myReport' as const,
  report: {
    publicRef: 'abcd1234',
    reportType: 'flood' as const,
    severity: 'high' as const,
    lat: 14.1,
    lng: 122.9,
    submittedAt: Date.now() - 720000,
    status: 'new' as const,
    municipalityLabel: 'Daet',
  },
}

beforeEach(() => {
  vi.useRealTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('DetailSheet — public mode', () => {
  it('renders null when hidden', () => {
    const { container } = render(
      <DetailSheet sheetPhase="hidden" onClose={vi.fn()} onCollapse={vi.fn()} {...publicProps} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders incident type and severity', () => {
    render(
      <DetailSheet sheetPhase="expanded" onClose={vi.fn()} onCollapse={vi.fn()} {...publicProps} />,
    )
    expect(screen.getByText(/Flood/i)).toBeInTheDocument()
    expect(screen.getByText(/HIGH/i)).toBeInTheDocument()
  })

  it('does not render edit or cancel buttons', () => {
    render(
      <DetailSheet sheetPhase="expanded" onClose={vi.fn()} onCollapse={vi.fn()} {...publicProps} />,
    )
    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /cancel/i })).toBeNull()
  })

  it('calls onClose when Close is clicked', () => {
    const onClose = vi.fn()
    render(
      <DetailSheet sheetPhase="expanded" onClose={onClose} onCollapse={vi.fn()} {...publicProps} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('DetailSheet — myReport mode', () => {
  it('shows tracking code', () => {
    render(
      <DetailSheet
        sheetPhase="expanded"
        onClose={vi.fn()}
        onCollapse={vi.fn()}
        {...myReportProps}
      />,
    )
    expect(screen.getByText('abcd1234')).toBeInTheDocument()
  })

  it('shows edit and cancel for new', () => {
    render(
      <DetailSheet
        sheetPhase="expanded"
        onClose={vi.fn()}
        onCollapse={vi.fn()}
        {...myReportProps}
      />,
    )
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel report/i })).toBeInTheDocument()
  })

  it('shows request correction for verified', () => {
    render(
      <DetailSheet
        sheetPhase="expanded"
        onClose={vi.fn()}
        onCollapse={vi.fn()}
        mode="myReport"
        report={{ ...myReportProps.report, status: 'verified' }}
      />,
    )
    expect(screen.getByRole('button', { name: /request correction/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull()
  })

  it('changes copy label to Copied and resets after 2s', () => {
    vi.useFakeTimers()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    })
    render(
      <DetailSheet
        sheetPhase="expanded"
        onClose={vi.fn()}
        onCollapse={vi.fn()}
        {...myReportProps}
      />,
    )
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /copy/i }))
    })
    expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByRole('button', { name: /^copy$/i })).toBeInTheDocument()
  })
})

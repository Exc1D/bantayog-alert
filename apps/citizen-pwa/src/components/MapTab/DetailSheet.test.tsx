import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

const { mockAuth, mockHttpsCallable } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockHttpsCallable: vi.fn(),
}))

vi.mock('../../services/firebase.js', () => ({
  auth: mockAuth,
  fns: () => 'mocked-functions',
  httpsCallable: mockHttpsCallable,
}))

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
    id: 'report-id-5678',
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
  window.localStorage.clear()
  mockAuth.mockReturnValue({ currentUser: { uid: 'citizen-1', isAnonymous: false } })
  mockHttpsCallable.mockReset()
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
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull()
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

  it('shows edit button for new', () => {
    render(
      <DetailSheet
        sheetPhase="expanded"
        onClose={vi.fn()}
        onCollapse={vi.fn()}
        {...myReportProps}
      />,
    )
    expect(screen.getByRole('button', { name: /edit report/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
  })

  it('does not show delete button', () => {
    render(
      <DetailSheet
        sheetPhase="expanded"
        onClose={vi.fn()}
        onCollapse={vi.fn()}
        {...myReportProps}
      />,
    )
    expect(screen.queryByRole('button', { name: /delete report/i })).toBeNull()
  })

  it('shows a citizen tracking timeline with lifecycle milestones', () => {
    render(
      <DetailSheet
        sheetPhase="expanded"
        onClose={vi.fn()}
        onCollapse={vi.fn()}
        mode="myReport"
        report={{
          ...myReportProps.report,
          status: 'en_route',
          lastStatusAt: Date.now() - 600000,
        }}
      />,
    )
    expect(screen.getByRole('heading', { name: /tracking timeline/i })).toBeInTheDocument()
    expect(screen.getByText('Report received')).toBeInTheDocument()
    expect(screen.getByText('First review')).toBeInTheDocument()
    expect(screen.getByText('Verified')).toBeInTheDocument()
    expect(screen.getByText('Responder en route')).toBeInTheDocument()
    expect(screen.getByText('Resolution')).toBeInTheDocument()
    expect(screen.getByText(/updated/i)).toBeInTheDocument()
  })

  it('asks for resolved-report feedback and thanks the citizen after submit', async () => {
    const submitFeedback = vi.fn().mockResolvedValue({ data: { reportId: 'report-id-5678' } })
    mockHttpsCallable.mockReturnValue(submitFeedback)

    render(
      <DetailSheet
        sheetPhase="expanded"
        onClose={vi.fn()}
        onCollapse={vi.fn()}
        mode="myReport"
        report={{
          ...myReportProps.report,
          status: 'resolved',
          lastStatusAt: Date.now() - 600000,
        }}
      />,
    )

    expect(screen.getByText(/was this addressed/i)).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^yes$/i }))
      await Promise.resolve()
    })

    expect(mockHttpsCallable).toHaveBeenCalledWith('mocked-functions', 'submitReportFeedback')
    expect(submitFeedback).toHaveBeenCalledWith({ reportId: 'report-id-5678', addressed: true })
    expect(screen.getByText(/thanks for the feedback/i)).toBeInTheDocument()
    expect(screen.queryByText(/was this addressed/i)).toBeNull()
  })

  it('does not ask anonymous sessions for resolved-report feedback', () => {
    mockAuth.mockReturnValue({ currentUser: { uid: 'anon-1', isAnonymous: true } })

    render(
      <DetailSheet
        sheetPhase="expanded"
        onClose={vi.fn()}
        onCollapse={vi.fn()}
        mode="myReport"
        report={{
          ...myReportProps.report,
          status: 'resolved',
          lastStatusAt: Date.now() - 600000,
        }}
      />,
    )

    expect(screen.queryByText(/was this addressed/i)).toBeNull()
    expect(mockHttpsCallable).not.toHaveBeenCalled()
  })

  it('keeps the feedback prompt retryable when submit fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const submitFeedback = vi.fn().mockRejectedValue(new Error('offline'))
    mockHttpsCallable.mockReturnValue(submitFeedback)

    render(
      <DetailSheet
        sheetPhase="expanded"
        onClose={vi.fn()}
        onCollapse={vi.fn()}
        mode="myReport"
        report={{
          ...myReportProps.report,
          status: 'resolved',
          lastStatusAt: Date.now() - 600000,
        }}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^no$/i }))
      await Promise.resolve()
    })

    expect(submitFeedback).toHaveBeenCalledWith({ reportId: 'report-id-5678', addressed: false })
    expect(screen.getByRole('alert')).toHaveTextContent(/could not send your feedback/i)
    expect(screen.getByText(/was this addressed/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^no$/i })).toBeEnabled()
    consoleError.mockRestore()
  })

  it('shows a terminal tracking outcome for rejected reports', () => {
    render(
      <DetailSheet
        sheetPhase="expanded"
        onClose={vi.fn()}
        onCollapse={vi.fn()}
        mode="myReport"
        report={{ ...myReportProps.report, status: 'rejected' }}
      />,
    )
    expect(screen.getByText('Not accepted')).toBeInTheDocument()
    expect(screen.getByText('MDRRMO did not accept this report')).toBeInTheDocument()
    expect(screen.queryByText('Responder en route')).toBeNull()
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
    expect(screen.queryByRole('button', { name: /edit report/i })).toBeNull()
  })

  it('changes copy label to Copied and resets after 2s', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
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
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy/i }))
      await Promise.resolve()
    })
    expect(writeText).toHaveBeenCalledOnce()
    expect(writeText).toHaveBeenCalledWith(myReportProps.report.publicRef)
    expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByRole('button', { name: /^copy$/i })).toBeInTheDocument()
  })
})

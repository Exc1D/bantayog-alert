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

import { DetailSheet, buildCitizenStatusHero } from './DetailSheet.js'
import type { MyReport } from './types.js'

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

function makeEnRouteReport(): MyReport {
  return {
    ...myReportProps.report,
    status: 'en_route',
    lastStatusAt: Date.now() - 600000,
  }
}

function renderEnRouteDetailSheet() {
  render(
    <DetailSheet
      sheetPhase="expanded"
      onClose={vi.fn()}
      onCollapse={vi.fn()}
      mode="myReport"
      report={makeEnRouteReport()}
    />,
  )
}

const baseReport: MyReport = {
  id: 'report-id-5678',
  publicRef: 'abcd1234',
  reportType: 'flood',
  severity: 'high',
  lat: 14.1,
  lng: 122.9,
  submittedAt: Date.now() - 720000,
  status: 'new',
  municipalityLabel: 'Daet',
  lastStatusAt: Date.now() - 600000,
}

describe('buildCitizenStatusHero', () => {
  it.each([
    [
      'queued',
      'Saved on this phone',
      'It will send automatically when you are back online.',
      'Keep this device available so the report can retry.',
    ],
    [
      'draft_inbox',
      'Saved on this phone',
      'It will send automatically when you are back online.',
      'Keep this device available so the report can retry.',
    ],
    [
      'new',
      'Your report was received',
      'An operator is checking the details. You do not need to submit again unless the situation changes.',
      'Watch this page for verification and responder updates.',
    ],
    [
      'awaiting_verify',
      'Your report was received',
      'An operator is checking the details. You do not need to submit again unless the situation changes.',
      'Watch this page for verification and responder updates.',
    ],
    [
      'verified',
      'Your report was verified',
      'It is now being handled.',
      'Watch this page for responder updates.',
    ],
    [
      'assigned',
      'A responder has been assigned',
      'Please stay safe and avoid the affected area.',
      'Call responders only if the danger changes or people need urgent help.',
    ],
    [
      'acknowledged',
      'A responder has been assigned',
      'Please stay safe and avoid the affected area.',
      'Call responders only if the danger changes or people need urgent help.',
    ],
    [
      'en_route',
      'Help is on the way',
      'Please stay safe and avoid the affected area.',
      'Keep this tracking code available for follow-up.',
    ],
    [
      'on_scene',
      'Responders are at or near the area',
      'Emergency staff are checking the situation on scene.',
      'Stay clear of the affected area unless responders ask for information.',
    ],
    [
      'resolved',
      'This report was resolved',
      'Reported',
      'Your report helped complete the response loop.',
    ],
    [
      'closed',
      'This report was resolved',
      'Reported',
      'Your report helped complete the response loop.',
    ],
    [
      'rejected',
      'This report could not be verified',
      'The review did not confirm enough details to keep it active.',
      'Submit a new report only if the situation changes or you have clearer details.',
    ],
    [
      'cancelled',
      'Your report was withdrawn',
      'It is no longer active, and the audit record is kept.',
      'Submit a new report only if there is a new or changing emergency.',
    ],
    [
      'cancelled_false_report',
      'Your report was withdrawn',
      'It is no longer active, and the audit record is kept.',
      'Submit a new report only if there is a new or changing emergency.',
    ],
    [
      'merged_as_duplicate',
      'This report was merged with another report',
      'Operators found another report for the same incident.',
      'The response continues through the main incident record.',
    ],
    [
      'reopened',
      'Your report is under review again',
      'Operators reopened the report to check new information.',
      'Watch this page for the next status update.',
    ],
  ] as const)('maps %s reports to lifecycle copy', (status, title, explanation, nextStep) => {
    const hero = buildCitizenStatusHero({ ...baseReport, status })

    expect(hero.title).toBe(title)
    expect(hero.explanation).toContain(explanation)
    expect(hero.nextStep).toBe(nextStep)
    expect(hero.updated).toMatch(/^Updated /)
  })

  it('uses resolved timing copy for resolved and closed reports', () => {
    expect(buildCitizenStatusHero({ ...baseReport, status: 'resolved' }).explanation).toContain(
      'Reported',
    )
    expect(buildCitizenStatusHero({ ...baseReport, status: 'resolved' }).explanation).toContain(
      'resolved',
    )
    expect(buildCitizenStatusHero({ ...baseReport, status: 'closed' }).explanation).toContain(
      'Reported',
    )
    expect(buildCitizenStatusHero({ ...baseReport, status: 'closed' }).explanation).toContain(
      'resolved',
    )
  })

  it('falls back to review copy for unknown statuses', () => {
    const hero = buildCitizenStatusHero({
      ...baseReport,
      status: 'unknown_status' as MyReport['status'],
    })

    expect(hero.title).toBe('Your report is being reviewed')
    expect(hero.explanation).toBe('Operators are checking the latest status.')
    expect(hero.nextStep).toBe('Watch this page for updates.')
  })
})

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
    renderEnRouteDetailSheet()

    expect(screen.getByRole('heading', { name: /tracking timeline/i })).toBeInTheDocument()
    expect(screen.getByText('Report received')).toBeInTheDocument()
    expect(screen.getByText('First review')).toBeInTheDocument()
    expect(screen.getByText('Verified')).toBeInTheDocument()
    expect(screen.getByText('Responder en route')).toBeInTheDocument()
    expect(screen.getByText('Resolution')).toBeInTheDocument()
    expect(screen.getAllByText(/updated/i).length).toBeGreaterThan(0)
  })

  it('leads en route reports with a human status hero', () => {
    renderEnRouteDetailSheet()

    expect(screen.getByRole('heading', { name: 'Help is on the way' })).toBeInTheDocument()
    expect(screen.getByText(/please stay safe and avoid the affected area/i)).toBeInTheDocument()
    expect(screen.queryByText(/^Flood · en route$/)).not.toBeInTheDocument()
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

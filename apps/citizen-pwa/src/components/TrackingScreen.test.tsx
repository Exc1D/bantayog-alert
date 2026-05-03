import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../hooks/useReport.js', () => ({
  useReport: vi.fn(),
}))
vi.mock('./ui/RadarRings.js', () => ({
  RadarRings: ({ color }: { color: string }) => (
    <div data-testid="radar-rings" data-color={color} />
  ),
}))

import { TrackingScreen } from './TrackingScreen'
import { useReport } from '../hooks/useReport.js'

const mockUseReport = vi.mocked(useReport)

function renderScreen(ref = 'a1b2c3d4') {
  return render(
    <MemoryRouter initialEntries={[`/reports/${ref}`]}>
      <Routes>
        <Route path="/reports/:reference" element={<TrackingScreen />} />
      </Routes>
    </MemoryRouter>,
  )
}

function mockReport(overrides: Partial<{ status: string; timeline: unknown[] }> = {}) {
  mockUseReport.mockReturnValue({
    data: {
      id: 'r1',
      status: overrides.status ?? 'awaiting_verify',
      timeline: (overrides.timeline ?? []) as never,
      reportType: 'flood',
      createdAt: 1713350400000,
      reporterName: 'Juan',
      reporterPhone: '09171234567',
      location: { lat: 14.11, lng: 122.95, address: 'Test St' },
    } as never,
    isPending: false,
    error: null,
  } as never)
}

describe('TrackingScreen', () => {
  it('shows brand-500 hero for awaiting_verify', () => {
    mockReport({ status: 'awaiting_verify' })
    renderScreen()
    expect(screen.getByText("Your report is in the queue. We've got it.")).toBeInTheDocument()
    expect(screen.getByTestId('radar-rings')).toBeInTheDocument()
  })

  it('shows success hero for resolved', () => {
    mockReport({ status: 'resolved' })
    renderScreen()
    expect(screen.getByText('Situation resolved. Thank you.')).toBeInTheDocument()
    expect(screen.queryByTestId('radar-rings')).not.toBeInTheDocument()
  })

  it('shows warning hero for en_route', () => {
    mockReport({ status: 'en_route' })
    renderScreen()
    expect(screen.getByText('Help is on the way.')).toBeInTheDocument()
    expect(screen.getByTestId('radar-rings')).toBeInTheDocument()
  })

  it('shows surface hero for rejected', () => {
    mockReport({ status: 'rejected' })
    renderScreen()
    expect(screen.getByText('This report was not accepted for review.')).toBeInTheDocument()
    expect(screen.queryByTestId('radar-rings')).not.toBeInTheDocument()
  })

  it('humanizes timeline event labels', () => {
    mockReport({
      status: 'awaiting_verify',
      timeline: [
        { event: 'new', timestamp: 1713350400000, actor: 'system' },
        { event: 'awaiting_verify', timestamp: 1713350401000, actor: 'system' },
      ],
    })
    renderScreen()
    expect(screen.getByText('Report received')).toBeInTheDocument()
    expect(screen.getByText('Under review by MDRRMO')).toBeInTheDocument()
  })

  it('shows Awaiting resolution pending event for non-terminal status', () => {
    mockReport({ status: 'awaiting_verify', timeline: [] })
    renderScreen()
    expect(screen.getByText('Awaiting resolution')).toBeInTheDocument()
  })

  it('does not show Awaiting resolution for resolved status', () => {
    mockReport({ status: 'resolved', timeline: [] })
    renderScreen()
    expect(screen.queryByText('Awaiting resolution')).not.toBeInTheDocument()
  })
})

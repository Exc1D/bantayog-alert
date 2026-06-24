import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  NewReportSignalProvider,
  publishReportSnapshot,
  useNewReportSignal,
} from './useNewReportSignal'

const audioMocks = vi.hoisted(() => ({
  play: vi.fn(),
  playError: vi.fn(),
  toggle: vi.fn(),
}))

vi.mock('./useAudioAlerts', () => ({
  useAudioAlerts: () => ({
    enabled: true,
    play: audioMocks.play,
    playError: audioMocks.playError,
    toggle: audioMocks.toggle,
  }),
}))

function SignalProbe() {
  const signal = useNewReportSignal()
  return (
    <>
      <output aria-label="new report count">{signal.notificationCount}</output>
      <output aria-label="triage decision count">{signal.triageDecisionCount}</output>
      <Link to="/triage">Triage</Link>
    </>
  )
}

function renderSignalHarness() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <NewReportSignalProvider>
        <SignalProbe />
      </NewReportSignalProvider>
    </MemoryRouter>,
  )
}

describe('useNewReportSignal', () => {
  beforeEach(() => {
    document.title = 'Bantayog Command'
    audioMocks.play.mockClear()
    audioMocks.playError.mockClear()
    audioMocks.toggle.mockClear()
  })

  it('signals new report arrivals after the watermark and clears on triage visit', async () => {
    const user = userEvent.setup()
    renderSignalHarness()

    act(() => {
      publishReportSnapshot([])
    })

    act(() => {
      publishReportSnapshot([
        {
          id: 'report-old',
          status: 'new',
          createdAt: '2000-01-01T00:00:00.000Z',
        },
        {
          id: 'report-new',
          status: 'new',
          createdAt: '2999-01-01T00:00:00.000Z',
        },
      ])
    })

    expect(screen.getByLabelText('new report count')).toHaveTextContent('1')
    expect(audioMocks.play).toHaveBeenCalledTimes(1)
    expect(document.title).toBe('(1) Bantayog Command')

    await user.click(screen.getByRole('link', { name: 'Triage' }))

    await waitFor(() => {
      expect(screen.getByLabelText('new report count')).toHaveTextContent('0')
    })
    expect(document.title).toBe('Bantayog Command')
  })

  it('counts only reports needing triage decisions', () => {
    renderSignalHarness()

    act(() => {
      publishReportSnapshot([
        { id: 'r-new', status: 'new', createdAt: '2999-01-01T00:00:00.000Z' },
        {
          id: 'r-awaiting',
          status: 'awaiting_verify',
          createdAt: '2999-01-01T00:00:00.000Z',
        },
        { id: 'r-verified', status: 'verified', createdAt: '2999-01-01T00:00:00.000Z' },
      ])
    })

    expect(screen.getByLabelText('triage decision count')).toHaveTextContent('2')
  })
})

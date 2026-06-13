import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CommandHeader } from '../components/CommandHeader'
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

vi.mock('@bantayog/shared-ui', () => ({
  useAuth: () => ({ claims: null }),
}))

// CommandHeader statically imports EditHotlineModal, which imports ../app/firebase.
// Stub it so module evaluation does not initialize a real Firebase Auth client.
vi.mock('../app/firebase', () => ({ db: {} }))

function SignalProbe() {
  const signal = useNewReportSignal()
  return <output aria-label="new report count">{signal.notificationCount}</output>
}

function renderSignalHarness() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <NewReportSignalProvider>
        <CommandHeader title="PDRRMO Camarines Norte" windowRole="dashboard" />
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
    expect(screen.getByRole('button', { name: '1 notifications' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Triage' }))

    await waitFor(() => {
      expect(screen.getByLabelText('new report count')).toHaveTextContent('0')
    })
    expect(document.title).toBe('Bantayog Command')
  })
})

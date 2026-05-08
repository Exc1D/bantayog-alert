import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const sosState = vi.hoisted(() => ({
  trigger: vi.fn(),
  loading: false,
  error: undefined as Error | undefined,
}))

vi.mock('../hooks/useTriggerSOS', () => ({
  useTriggerSOS: () => sosState,
}))

import { SosPage } from './SosPage'

describe('SosPage', () => {
  beforeEach(() => {
    sosState.trigger.mockClear()
    sosState.loading = false
    sosState.error = undefined
  })

  it('renders the SOS activation title and confirm button', () => {
    render(
      <MemoryRouter initialEntries={['/dispatches/d-1/sos']}>
        <Routes>
          <Route path="/dispatches/:dispatchId/sos" element={<SosPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/SOS ACTIVATION/i)
    expect(screen.getByRole('button', { name: /confirm sos/i })).toBeInTheDocument()
  })

  it('calls trigger and navigates on confirm click', async () => {
    sosState.trigger.mockResolvedValueOnce(undefined)

    render(
      <MemoryRouter initialEntries={['/dispatches/d-1/sos']}>
        <Routes>
          <Route path="/dispatches/:dispatchId/sos" element={<SosPage />} />
        </Routes>
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /confirm sos/i }))

    expect(sosState.trigger).toHaveBeenCalledTimes(1)
  })

  it('shows an error alert when triggerSOS has failed', () => {
    sosState.error = new Error('trigger failed')

    render(
      <MemoryRouter initialEntries={['/dispatches/d-1/sos']}>
        <Routes>
          <Route path="/dispatches/:dispatchId/sos" element={<SosPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(/Unable to trigger SOS/)
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.hoisted(() => vi.fn())
const mockCallable = vi.hoisted(() => vi.fn())
const mockHttpsCallable = vi.hoisted(() => vi.fn(() => mockCallable))

vi.mock('../app/firebase', () => ({ functions: {} }))
vi.mock('firebase/functions', () => ({ httpsCallable: mockHttpsCallable }))
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import { ShiftHandoffPage } from './ShiftHandoffPage'

describe('ShiftHandoffPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders handoff form with target responder field', () => {
    render(
      <MemoryRouter>
        <ShiftHandoffPage />
      </MemoryRouter>,
    )
    expect(screen.getByText(/shift handoff/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/target responder/i)).toBeInTheDocument()
  })

  it('shows validation error when fields are empty', async () => {
    render(
      <MemoryRouter>
        <ShiftHandoffPage />
      </MemoryRouter>,
    )

    // Bypass HTML5 form validation by firing submit directly on the form
    const form = screen.getByLabelText(/target responder/i).closest('form')
    if (form) fireEvent.submit(form)

    expect(await screen.findByRole('alert')).toHaveTextContent(/required/i)
    expect(mockHttpsCallable).not.toHaveBeenCalled()
  })

  it('submits handoff with idempotency key', async () => {
    mockCallable.mockResolvedValue({ data: { success: true } })

    render(
      <MemoryRouter>
        <ShiftHandoffPage />
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/target responder/i), 'responder-uid-2')
    await user.type(screen.getByLabelText(/handoff notes/i), 'Patient needs follow-up')
    await user.click(screen.getByRole('button', { name: /submit handoff/i }))

    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'initiateResponderHandoff')
    expect(mockCallable).toHaveBeenCalledWith(
      expect.objectContaining({
        toUid: 'responder-uid-2',
        reason: 'Patient needs follow-up',
        idempotencyKey: expect.any(String),
      }),
    )
  })

  it('shows success state after submission', async () => {
    mockCallable.mockResolvedValue({ data: { success: true } })

    render(
      <MemoryRouter>
        <ShiftHandoffPage />
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/target responder/i), 'responder-uid-2')
    await user.type(screen.getByLabelText(/handoff notes/i), 'Truck is fueled')
    await user.click(screen.getByRole('button', { name: /submit handoff/i }))

    expect(await screen.findByText(/handoff submitted successfully/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back to profile/i })).toBeInTheDocument()
  })

  it('displays error when callable fails', async () => {
    mockCallable.mockRejectedValue(new Error('target_not_found'))

    render(
      <MemoryRouter>
        <ShiftHandoffPage />
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/target responder/i), 'bad-uid')
    await user.type(screen.getByLabelText(/handoff notes/i), 'Some notes')
    await user.click(screen.getByRole('button', { name: /submit handoff/i }))

    await screen.findByRole('alert')
    expect(screen.getByRole('alert')).toHaveTextContent(/target_not_found/i)
  })
})

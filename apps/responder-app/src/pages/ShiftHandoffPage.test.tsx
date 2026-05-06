import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../app/firebase', () => ({ functions: {} }))
vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn(() => vi.fn()) }))
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => vi.fn() }
})

import { ShiftHandoffPage } from './ShiftHandoffPage'

describe('ShiftHandoffPage', () => {
  it('renders handoff form with target responder field', () => {
    render(
      <MemoryRouter>
        <ShiftHandoffPage />
      </MemoryRouter>,
    )
    expect(screen.getByText(/shift handoff/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/target responder/i)).toBeInTheDocument()
  })
})

import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  }
})

import { RaceLossScreen } from './RaceLossScreen'

describe('RaceLossScreen', () => {
  it('renders reassignment copy and a back button', () => {
    render(
      <MemoryRouter>
        <RaceLossScreen />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Already Claimed/i)
    expect(screen.getByText(/Another responder accepted/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back to dispatches/i })).toBeInTheDocument()
  })
})

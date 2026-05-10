import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CommandHeader } from '../components/CommandHeader'

describe('CommandHeader', () => {
  it('renders title and live indicator', () => {
    render(<CommandHeader title="PDRRMO Camarines Norte" lastUpdatedAt={Date.now()} />)
    expect(screen.getByText('PDRRMO Camarines Norte')).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('opens map window when clicked', async () => {
    const user = userEvent.setup()
    const onOpenMap = vi.fn()
    render(<CommandHeader title="Test" lastUpdatedAt={Date.now()} onOpenMap={onOpenMap} />)
    await user.click(screen.getByRole('button', { name: /open map/i }))
    expect(onOpenMap).toHaveBeenCalled()
  })
})

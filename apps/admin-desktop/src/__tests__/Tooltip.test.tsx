import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Tooltip } from '../components/Tooltip'

describe('Tooltip', () => {
  it('shows tooltip text on hover', async () => {
    render(
      <Tooltip content="This is a helpful hint">
        <button>Hover me</button>
      </Tooltip>,
    )

    const trigger = screen.getByRole('button', { name: 'Hover me' })
    fireEvent.mouseEnter(trigger)

    expect(await screen.findByText('This is a helpful hint')).toBeInTheDocument()
  })

  it('hides tooltip on mouse leave', async () => {
    render(
      <Tooltip content="This is a helpful hint">
        <button>Hover me</button>
      </Tooltip>,
    )

    const trigger = screen.getByRole('button', { name: 'Hover me' })
    fireEvent.mouseEnter(trigger)
    expect(await screen.findByText('This is a helpful hint')).toBeInTheDocument()

    fireEvent.mouseLeave(trigger)
    expect(screen.queryByText('This is a helpful hint')).not.toBeInTheDocument()
  })

  it('supports keyboard focus trigger', async () => {
    render(
      <Tooltip content="Keyboard accessible">
        <button>Focus me</button>
      </Tooltip>,
    )

    const trigger = screen.getByRole('button')
    fireEvent.focus(trigger)

    expect(await screen.findByText('Keyboard accessible')).toBeInTheDocument()
  })

  it('has aria-describedby linking trigger to tooltip', async () => {
    render(
      <Tooltip content="Describes the action">
        <button>Action</button>
      </Tooltip>,
    )

    const trigger = screen.getByRole('button')
    fireEvent.mouseEnter(trigger)

    const tooltip = await screen.findByText('Describes the action')
    expect(trigger.parentElement).toHaveAttribute('aria-describedby', tooltip.id)
  })
})

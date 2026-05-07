import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { PreArrivalInfo } from './PreArrivalInfo'

describe('PreArrivalInfo', () => {
  it('renders the Pre-arrival Information toggle button', () => {
    render(<PreArrivalInfo reportType="flood" distanceMeters={null} />)
    expect(screen.getByRole('button', { name: /pre-arrival info/i })).toBeInTheDocument()
  })

  it('is collapsed by default', () => {
    render(<PreArrivalInfo reportType="flood" distanceMeters={null} />)
    expect(screen.queryByText(/life vest/i)).not.toBeInTheDocument()
  })

  it('expands when the toggle button is clicked', async () => {
    const user = userEvent.setup()
    render(<PreArrivalInfo reportType="flood" distanceMeters={null} />)

    await user.click(screen.getByRole('button', { name: /pre-arrival info/i }))

    expect(screen.getByText(/life vest/i)).toBeInTheDocument()
  })

  it('collapses again when toggle button is clicked a second time', async () => {
    const user = userEvent.setup()
    render(<PreArrivalInfo reportType="flood" distanceMeters={null} />)

    await user.click(screen.getByRole('button', { name: /pre-arrival info/i }))
    expect(screen.getByText(/life vest/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /pre-arrival info/i }))
    expect(screen.queryByText(/life vest/i)).not.toBeInTheDocument()
  })

  it('shows fire gear checklist for fire reportType', async () => {
    const user = userEvent.setup()
    render(<PreArrivalInfo reportType="fire" distanceMeters={null} />)

    await user.click(screen.getByRole('button', { name: /pre-arrival info/i }))

    expect(screen.getByText(/scba/i)).toBeInTheDocument()
  })

  it('shows flood gear checklist for flood reportType', async () => {
    const user = userEvent.setup()
    render(<PreArrivalInfo reportType="flood" distanceMeters={null} />)

    await user.click(screen.getByRole('button', { name: /pre-arrival info/i }))

    expect(screen.getByText(/life vest/i)).toBeInTheDocument()
  })

  it('shows medical gear checklist for medical reportType', async () => {
    const user = userEvent.setup()
    render(<PreArrivalInfo reportType="medical" distanceMeters={null} />)

    await user.click(screen.getByRole('button', { name: /pre-arrival info/i }))

    expect(screen.getByText(/defibrillator/i)).toBeInTheDocument()
  })

  it('checklist items start unchecked and can be toggled', async () => {
    const user = userEvent.setup()
    render(<PreArrivalInfo reportType="flood" distanceMeters={null} />)

    await user.click(screen.getByRole('button', { name: /pre-arrival info/i }))

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes[0]).not.toBeChecked()

    await user.click(checkboxes[0]!)
    expect(checkboxes[0]).toBeChecked()
  })

  it('shows distance when distanceMeters is provided', async () => {
    const user = userEvent.setup()
    render(<PreArrivalInfo reportType="flood" distanceMeters={1200} />)

    await user.click(screen.getByRole('button', { name: /pre-arrival info/i }))

    expect(screen.getByText(/1\.2 km/i)).toBeInTheDocument()
  })

  it('shows "Location not available" when distanceMeters is null', async () => {
    const user = userEvent.setup()
    render(<PreArrivalInfo reportType="flood" distanceMeters={null} />)

    await user.click(screen.getByRole('button', { name: /pre-arrival info/i }))

    expect(screen.getByText(/location not available/i)).toBeInTheDocument()
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MunicipalDrillDown } from '../components/MunicipalDrillDown'
import type { MunicipalPerformance } from '../types'

const mockMuni: MunicipalPerformance = {
  municipality: 'Capalonga',
  activeIncidents: 3,
  activeResponders: 9,
  avgResponseTime: '18 min',
  unresolvedOver24h: 2,
  adminOnDuty: true,
  adminName: 'Santos',
}

describe('MunicipalDrillDown', () => {
  it('renders municipality name', () => {
    render(
      <MunicipalDrillDown
        data={mockMuni}
        onClose={vi.fn()}
        onViewAll={vi.fn()}
        onContactAdmin={vi.fn()}
      />,
    )
    expect(screen.getByText('Capalonga Municipality')).toBeInTheDocument()
  })

  it('shows active incidents count', () => {
    render(
      <MunicipalDrillDown
        data={mockMuni}
        onClose={vi.fn()}
        onViewAll={vi.fn()}
        onContactAdmin={vi.fn()}
      />,
    )
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('Active Incidents')).toBeInTheDocument()
  })

  it('shows available responders', () => {
    render(
      <MunicipalDrillDown
        data={mockMuni}
        onClose={vi.fn()}
        onViewAll={vi.fn()}
        onContactAdmin={vi.fn()}
      />,
    )
    expect(screen.getByText('9')).toBeInTheDocument()
    expect(screen.getByText('Available Responders')).toBeInTheDocument()
  })

  it('shows admin name when on duty', () => {
    render(
      <MunicipalDrillDown
        data={mockMuni}
        onClose={vi.fn()}
        onViewAll={vi.fn()}
        onContactAdmin={vi.fn()}
      />,
    )
    expect(screen.getByText('Santos (On Duty)')).toBeInTheDocument()
  })

  it('calls onClose when close button clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <MunicipalDrillDown
        data={mockMuni}
        onClose={onClose}
        onViewAll={vi.fn()}
        onContactAdmin={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onViewAll when View All clicked', async () => {
    const user = userEvent.setup()
    const onViewAll = vi.fn()
    render(
      <MunicipalDrillDown
        data={mockMuni}
        onClose={vi.fn()}
        onViewAll={onViewAll}
        onContactAdmin={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'View All' }))
    expect(onViewAll).toHaveBeenCalledWith('Capalonga')
  })
})

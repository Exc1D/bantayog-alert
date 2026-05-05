import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WithdrawSheet } from './WithdrawSheet.js'

describe('WithdrawSheet', () => {
  it('renders nothing when not open', () => {
    const { container } = render(
      <WithdrawSheet
        open={false}
        publicRef="FL-001"
        reportType="Flood"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders title and consequence text when open', () => {
    render(
      <WithdrawSheet
        open={true}
        publicRef="FL-001"
        reportType="Flood"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByText(/Withdraw this report/i)).toBeInTheDocument()
    expect(screen.getByText(/FL-001/)).toBeInTheDocument()
    expect(screen.getByText(/Flood/i)).toBeInTheDocument()
  })

  it('calls onCancel when Keep Report is clicked', () => {
    const onCancel = vi.fn()
    render(
      <WithdrawSheet
        open={true}
        publicRef="FL-001"
        reportType="Flood"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /keep report/i }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('calls onConfirm when Withdraw Report is clicked', () => {
    const onConfirm = vi.fn()
    render(
      <WithdrawSheet
        open={true}
        publicRef="FL-001"
        reportType="Flood"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /withdraw report/i }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })
})

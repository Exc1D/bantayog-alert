import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DeleteSheet } from './DeleteSheet.js'

describe('DeleteSheet', () => {
  it('renders nothing when not open', () => {
    const { container } = render(
      <DeleteSheet
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
      <DeleteSheet
        open={true}
        publicRef="FL-001"
        reportType="Flood"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByText(/Delete this report/i)).toBeInTheDocument()
    expect(screen.getByText(/FL-001/)).toBeInTheDocument()
    expect(screen.getByText(/Flood/i)).toBeInTheDocument()
  })

  it('calls onCancel when Keep Report is clicked', () => {
    const onCancel = vi.fn()
    render(
      <DeleteSheet
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

  it('calls onConfirm when Delete Report is clicked', () => {
    const onConfirm = vi.fn()
    render(
      <DeleteSheet
        open={true}
        publicRef="FL-001"
        reportType="Flood"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /delete report/i }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })
})
